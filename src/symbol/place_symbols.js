// @flow

const symbolSize = require('./symbol_size');

module.exports = {
    updateOpacities: updateOpacities,
    place: place
};

function updateOpacity(symbolInstance, opacityState, targetOpacity, opacityUpdateTime, collisionFadeTimes) {
    if (symbolInstance.isDuplicate) {
        opacityState.opacity = 0;
        opacityState.targetOpacity = 0;
    } else {
        if (opacityState.targetOpacity !== targetOpacity) {
            collisionFadeTimes.latestStart = opacityUpdateTime;
        }
        const increment = collisionFadeTimes.duration ? ((opacityUpdateTime - opacityState.time) / collisionFadeTimes.duration) : 1;
        opacityState.opacity = Math.max(0, Math.min(1, opacityState.opacity + (opacityState.targetOpacity === 1 ? increment : -increment)));
        opacityState.targetOpacity = targetOpacity;
        opacityState.time = opacityUpdateTime;
    }
}

function updateOpacities(bucket: any, collisionFadeTimes: any) {
    const glyphOpacityArray = bucket.text && bucket.text.opacityVertexArray;
    const iconOpacityArray = bucket.icon && bucket.icon.opacityVertexArray;
    if (glyphOpacityArray) glyphOpacityArray.clear();
    if (iconOpacityArray) iconOpacityArray.clear();

    bucket.fadeStartTime = Date.now();

    for (const symbolInstance of bucket.symbolInstances) {

        const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
        const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);

        if (!hasText && !hasIcon) continue;

        if (hasText) {
            const targetOpacity = symbolInstance.placedText ? 1.0 : 0.0;
            const opacityState = symbolInstance.textOpacityState;
            updateOpacity(symbolInstance, opacityState, targetOpacity, bucket.fadeStartTime, collisionFadeTimes);
            for (const placedTextSymbolIndex of symbolInstance.placedTextSymbolIndices) {
                const placedSymbol = bucket.placedGlyphArray.get(placedTextSymbolIndex);
                // If this label is completely faded, mark it so that we don't have to calculate
                // its position at render time
                placedSymbol.hidden = opacityState.opacity === 0 && opacityState.targetOpacity === 0;
            }

            for (let i = 0; i < symbolInstance.numGlyphVertices; i++) {
                glyphOpacityArray.emplaceBack(opacityState.opacity * 10000, opacityState.targetOpacity);
            }
            // Vertical text fades in/out on collision the same way as corresponding
            // horizontal text. Switch between vertical/horizontal should be instantaneous
            for (let i = 0; i < symbolInstance.numVerticalGlyphVertices; i++) {
                glyphOpacityArray.emplaceBack(opacityState.opacity * 10000, opacityState.targetOpacity);
            }
        }

        if (hasIcon) {
            const targetOpacity = symbolInstance.placedIcon ? 1.0 : 0.0;
            const opacityState = symbolInstance.iconOpacityState;
            updateOpacity(symbolInstance, opacityState, targetOpacity, bucket.fadeStartTime, collisionFadeTimes);
            for (let i = 0; i < symbolInstance.numIconVertices; i++) {
                iconOpacityArray.emplaceBack(opacityState.opacity * 10000, opacityState.targetOpacity);
            }
        }

    }

    if (glyphOpacityArray) bucket.text.opacityVertexBuffer.updateData(glyphOpacityArray.serialize());
    if (iconOpacityArray) bucket.icon.opacityVertexBuffer.updateData(iconOpacityArray.serialize());
}


function updateCollisionBoxes(collisionVertexArray: any, collisionBoxes: any, placed: boolean) {
    if (!collisionVertexArray) {
        return;
    }
    for (let k = 0; k < collisionBoxes.length; k += 6) {
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    }
}

function updateCollisionCircles(collisionVertexArray: any, collisionCircles: any, placed: boolean) {
    if (!collisionVertexArray) {
        return;
    }

    for (let k = 0; k < collisionCircles.length; k += 5) {
        const notUsed = collisionCircles[k + 4];
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    }
}

function place(bucket: any, collisionTile: any, showCollisionBoxes: boolean, zoom: number, pixelsToTileUnits: number, labelPlaneMatrix: any, tileID: number, collisionBoxArray: any) {
    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    const layer = bucket.layers[0];
    const layout = layer.layout;

    const scale = Math.pow(2, zoom - bucket.zoom);

    const collisionDebugBoxArray = showCollisionBoxes && bucket.collisionBox && bucket.collisionBox.collisionVertexArray;
    if (collisionDebugBoxArray) collisionDebugBoxArray.clear();

    const collisionDebugCircleArray = showCollisionBoxes && bucket.collisionCircle && bucket.collisionCircle.collisionVertexArray;
    if (collisionDebugCircleArray) collisionDebugCircleArray.clear();

    const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, collisionTile.transform, layer, true);

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

            if (symbolInstance.textCollisionCircles && symbolInstance.textCollisionCircles.length) {
                const placedSymbol = bucket.placedGlyphArray.get(symbolInstance.placedTextSymbolIndices[0]);
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
                    showCollisionBoxes);
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
            updateCollisionBoxes(collisionDebugBoxArray, symbolInstance.textCollisionBoxes, placeGlyph);
            updateCollisionCircles(collisionDebugCircleArray, symbolInstance.textCollisionCircles, placeGlyph);
            if (placeGlyph) {
                symbolInstance.placedText = true;
                collisionTile.insertCollisionBoxes(placedGlyphBoxes, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
                collisionTile.insertCollisionCircles(placedGlyphCircles, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
            } else {
                symbolInstance.placedText = false;
            }
        }

        if (hasIcon) {
            updateCollisionBoxes(collisionDebugBoxArray, symbolInstance.iconCollisionBoxes, placeIcon);
            if (placeIcon) {
                symbolInstance.placedIcon = true;
                collisionTile.insertCollisionBoxes(placedIconBoxes, layout['icon-ignore-placement'], tileID, symbolInstance.iconBoxStartIndex);
            } else {
                symbolInstance.placedIcon = false;
            }
        }

    }

    if (collisionDebugBoxArray) bucket.collisionBox.collisionVertexBuffer.updateData(collisionDebugBoxArray.serialize());
    if (collisionDebugCircleArray) bucket.collisionCircle.collisionVertexBuffer.updateData(collisionDebugCircleArray.serialize());
}
