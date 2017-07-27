// @flow

const symbolSize = require('./symbol_size');

module.exports = {
    updateOpacities: updateOpacities,
    place: place
};

function updateOpacity(symbolInstance, opacityState, targetOpacity) {
    if (symbolInstance.isDuplicate) {
        opacityState.opacity = 0;
        opacityState.targetOpacity = 0;
    } else {
        const now = Date.now();
        const increment = (now - opacityState.time) / 300;
        opacityState.opacity = Math.max(0, Math.min(1, opacityState.opacity + (opacityState.targetOpacity === 1 ? increment : -increment)));
        opacityState.targetOpacity = targetOpacity;
        opacityState.time = now;
    }
}

function updateOpacities(bucket: any, symbolOpacityIndex: any, coord: any, sourceMaxZoom: number) {
    const glyphOpacityArray = bucket.buffers.glyph && bucket.buffers.glyph.opacityVertexArray;
    const iconOpacityArray = bucket.buffers.icon && bucket.buffers.icon.opacityVertexArray;
    if (glyphOpacityArray) glyphOpacityArray.clear();
    if (iconOpacityArray) iconOpacityArray.clear();

    for (const symbolInstance of bucket.symbolInstances) {

        const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
        const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);

        if (!hasText && !hasIcon) continue;

        if (hasText) {

            const targetOpacity = symbolInstance.placedText ? 1.0 : 0.0;
            const opacityState = symbolInstance.textOpacityState;
            updateOpacity(symbolInstance, opacityState, targetOpacity);

            // TODO handle vertical text properly by choosing the correct version here
            const verticalOpacity = 0;

            for (let i = 0; i < symbolInstance.numGlyphVertices; i++) {
                glyphOpacityArray.emplaceBack(opacityState.opacity * 10000, targetOpacity);
            }
            for (let i = 0; i < symbolInstance.numVerticalGlyphVertices; i++) {
                glyphOpacityArray.emplaceBack(verticalOpacity * 10000, targetOpacity);
            }
        }

        if (hasIcon) {
            const targetOpacity = symbolInstance.placedIcon ? 1.0 : 0.0;
            const opacityState = symbolInstance.iconOpacityState;
            updateOpacity(symbolInstance, opacityState, targetOpacity);
            for (let i = 0; i < symbolInstance.numIconVertices; i++) {
                iconOpacityArray.emplaceBack(opacityState.opacity * 10000, targetOpacity);
            }
        }

    }

    if (glyphOpacityArray) bucket.buffers.glyph.opacityVertexBuffer.updateData(glyphOpacityArray.serialize());
    if (iconOpacityArray) bucket.buffers.icon.opacityVertexBuffer.updateData(iconOpacityArray.serialize());
}


function updateCollisionBoxes(collisionVertexArray: any, collisionBoxes: any, collisionCircles: any, placed: boolean) {
    if (!collisionVertexArray) {
        return;
    }
    for (let k = 0; k < collisionBoxes.length; k += 6) {
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    }

    for (let k = 0; k < collisionCircles.length; k += 5) {
        const notUsed = collisionCircles[k + 4];
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    }
}


function place(bucket: any, collisionTile: any, showCollisionBoxes: any, zoom: number, pixelsToTileUnits: number, labelPlaneMatrix: any, posMatrix: any, tileID: number, collisionBoxArray: any) {
    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    const layer = bucket.layers[0];
    const layout = layer.layout;

    const mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
        layout['text-ignore-placement'] || layout['icon-ignore-placement'];

    // Sort symbols by their y position on the canvas so that the lower symbols
    // are drawn on top of higher symbols.
    // Don't sort symbols that won't overlap because it isn't necessary and
    // because it causes more labels to pop in and out when rotating.
    if (mayOverlap) {
        const angle = collisionTile.transform.angle;

        const sin = Math.sin(angle),
            cos = Math.cos(angle);

        bucket.symbolInstances.sort((a, b) => {
            const aRotated = (sin * a.anchor.x + cos * a.anchor.y) | 0;
            const bRotated = (sin * b.anchor.x + cos * b.anchor.y) | 0;
            return (aRotated - bRotated) || (b.featureIndex - a.featureIndex);
        });
    }

    const scale = Math.pow(2, zoom - bucket.zoom);

    const collisionArray = showCollisionBoxes && bucket.buffers.collisionBox && bucket.buffers.collisionBox.collisionVertexArray;
    if (collisionArray) collisionArray.clear();

    const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, collisionTile.transform, layer, true);
    //const partiallyEvaluatedIconSize = symbolSize.evaluateSizeForZoom(bucket.iconSizeData, collisionTile.transform, layer, false);

    for (const symbolInstance of bucket.symbolInstances) {

        const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
        const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);
        if (!symbolInstance.textCollisionBoxes) {
            symbolInstance.textCollisionBoxes = bucket.deserializeCollisionBoxes(collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex);
        }
        if (!symbolInstance.textCollisionCirlces) {
            symbolInstance.textCollisionCircles = bucket.deserializeCollisionCircles(collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex);
        }
        if (!symbolInstance.iconCollisionBoxes) {
            symbolInstance.iconCollisionBoxes = bucket.deserializeCollisionBoxes(collisionBoxArray, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex);
        }

        const iconWithoutText = layout['text-optional'] || !hasText,
            textWithoutIcon = layout['icon-optional'] || !hasIcon;


        // Calculate the scales at which the text and icon can be placed without collision.
        let placedGlyphBoxes = [];
        let placedGlyphCircles = [];
        if (hasText) {
            placedGlyphBoxes = collisionTile.placeCollisionBoxes(symbolInstance.textCollisionBoxes,
                layout['text-allow-overlap'], scale, pixelsToTileUnits);

            if (symbolInstance.textCollisionCircles) {
                const placedSymbol = bucket.placedGlyphArray.get(symbolInstance.placedTextSymbolIndex);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                placedGlyphCircles = collisionTile.placeCollisionCircles(symbolInstance.textCollisionCircles,
                    layout['text-allow-overlap'],
                    scale,
                    pixelsToTileUnits,
                    symbolInstance.key,
                    placedSymbol,
                    bucket.lineVertexArray,
                    bucket.glyphOffsetArray,
                    fontSize,
                    labelPlaneMatrix,
                    posMatrix,
                    layout['text-pitch-alignment'] === 'map');
            }
        }

        const placedIconBoxes = hasIcon ?
            collisionTile.placeCollisionBoxes(symbolInstance.iconCollisionBoxes,
                layout['icon-allow-overlap'], scale, pixelsToTileUnits) :
            [];
        let placeGlyph = placedGlyphBoxes.length > 0 || placedGlyphCircles.length > 0;
        let placeIcon = placedIconBoxes.length > 0;

        // Combine the scales for icons and text.
        if (!iconWithoutText && !textWithoutIcon) {
            placeIcon = placeGlyph = placeIcon && placeGlyph;
        } else if (!textWithoutIcon) {
            placeGlyph = placeIcon && placeGlyph;
        } else if (!iconWithoutText) {
            placeIcon = placeIcon && placeGlyph;
        }


        // Insert final placement into collision tree and add glyphs/icons to buffers
        if (!hasText && !hasIcon) continue;

        if (hasText) {
            updateCollisionBoxes(collisionArray, symbolInstance.textCollisionBoxes, symbolInstance.textCollisionCircles, placeGlyph);
            if (placeGlyph) {
                symbolInstance.placedText = true;
                collisionTile.insertCollisionBoxes(placedGlyphBoxes, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
                collisionTile.insertCollisionCircles(placedGlyphCircles, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
            } else {
                symbolInstance.placedText = false;
            }
        }

        if (hasIcon) {
            updateCollisionBoxes(collisionArray, symbolInstance.iconCollisionBoxes, [], placeIcon);
            if (placeIcon) {
                symbolInstance.placedIcon = true;
                collisionTile.insertCollisionBoxes(placedIconBoxes, layout['icon-ignore-placement'], tileID, symbolInstance.iconBoxStartIndex);
            } else {
                symbolInstance.placedIcon = false;
            }
        }

    }

    if (collisionArray) bucket.buffers.collisionBox.collisionVertexBuffer.updateData(collisionArray.serialize());
}
