// @flow

const symbolSize = require('./symbol_size');

import type SymbolBucket, {SymbolInstance} from '../data/bucket/symbol_bucket';
import type OpacityState from './opacity_state';
import type CollisionIndex from './collision_index';
import type CollisionBoxArray from './collision_box';
const mat4 = require('@mapbox/gl-matrix').mat4;

module.exports = {
    updateOpacities: updateOpacities,
    place: place
};

function updateOpacity(symbolInstance: SymbolInstance, opacityState: OpacityState, targetOpacity: number, opacityUpdateTime: number, collisionFadeTimes: any) {
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

function updateOpacities(bucket: SymbolBucket, collisionFadeTimes: any) {
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
                const placedSymbol = (bucket.placedGlyphArray.get(placedTextSymbolIndex): any);
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


function updateCollisionBox(collisionVertexArray: any, placed: boolean) {
    if (!collisionVertexArray) {
        return;
    }
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
}

function updateCollisionCircles(collisionVertexArray: any, collisionCircles: Array<any>, placed: boolean, isDuplicate: boolean) {
    if (!collisionVertexArray) {
        return;
    }

    for (let k = 0; k < collisionCircles.length; k += 5) {
        const notUsed = isDuplicate || collisionCircles[k + 4];
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    }
}

function place(bucket: SymbolBucket, collisionIndex: CollisionIndex, showCollisionBoxes: boolean, zoom: number, pixelsToTileUnits: number, labelPlaneMatrix: mat4, tileID: number, collisionBoxArray: CollisionBoxArray) {
    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    const layer = bucket.layers[0];
    const layout = layer.layout;

    const scale = Math.pow(2, zoom - bucket.zoom);

    const collisionDebugBoxArray = showCollisionBoxes && bucket.collisionBox && bucket.collisionBox.collisionVertexArray;
    if (collisionDebugBoxArray) collisionDebugBoxArray.clear();

    const collisionDebugCircleArray = showCollisionBoxes && bucket.collisionCircle && bucket.collisionCircle.collisionVertexArray;
    if (collisionDebugCircleArray) collisionDebugCircleArray.clear();

    const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, collisionIndex.transform, layer, true);

    for (const symbolInstance of bucket.symbolInstances) {

        const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
        const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);
        if (!symbolInstance.collisionArrays) {
            symbolInstance.collisionArrays = bucket.deserializeCollisionBoxes(collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex);
        }

        const iconWithoutText = layout['text-optional'] || !hasText,
            textWithoutIcon = layout['icon-optional'] || !hasIcon;

        let placedGlyphBox = [];
        let placedIconBox = [];
        let placedGlyphCircles = [];
        if (!symbolInstance.isDuplicate) {
            // isDuplicate -> Although we're rendering this tile, this symbol is also present in
            // a child tile that will be rendered on top. Don't place this symbol, so that
            // there's room in the CollisionIndex for the child symbol.

            // Symbols that are in the parent but not the child will keep getting rendered
            // (and potentially colliding out child symbols) until the parent tile is removed.
            // It might be better to filter out all the parent symbols so that the child tile
            // starts rendering as close as possible to its final state?
            if (symbolInstance.collisionArrays.textBox) {
                placedGlyphBox = collisionIndex.placeCollisionBox(symbolInstance.collisionArrays.textBox,
                    layout['text-allow-overlap'], scale, pixelsToTileUnits);
            }

            if (symbolInstance.collisionArrays.iconBox) {
                placedIconBox = collisionIndex.placeCollisionBox(symbolInstance.collisionArrays.iconBox,
                    layout['icon-allow-overlap'], scale, pixelsToTileUnits);
            }

            const textCircles = symbolInstance.collisionArrays.textCircles;
            if (textCircles) {
                const placedSymbol = (bucket.placedGlyphArray.get(symbolInstance.placedTextSymbolIndices[0]): any);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                placedGlyphCircles = collisionIndex.placeCollisionCircles(textCircles,
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

        let placeGlyph = placedGlyphBox.length > 0 || placedGlyphCircles.length > 0;
        let placeIcon = placedIconBox.length > 0;

        // Combine the scales for icons and text.
        if (!iconWithoutText && !textWithoutIcon) {
            placeIcon = placeGlyph = placeIcon && placeGlyph;
        } else if (!textWithoutIcon) {
            placeGlyph = placeIcon && placeGlyph;
        } else if (!iconWithoutText) {
            placeIcon = placeIcon && placeGlyph;
        }

        symbolInstance.placedText = placeGlyph;
        symbolInstance.placedIcon = placeIcon;

        if (symbolInstance.collisionArrays.textBox) {
            updateCollisionBox(collisionDebugBoxArray, placeGlyph);
            if (placeGlyph) {
                collisionIndex.insertCollisionBox(placedGlyphBox, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
            }
        }
        if (symbolInstance.collisionArrays.iconBox) {
            updateCollisionBox(collisionDebugBoxArray, placeIcon);
            if (placeIcon) {
                collisionIndex.insertCollisionBox(placedIconBox, layout['icon-ignore-placement'], tileID, symbolInstance.iconBoxStartIndex);
            }
        }
        if (symbolInstance.collisionArrays.textCircles) {
            updateCollisionCircles(collisionDebugCircleArray, symbolInstance.collisionArrays.textCircles, placeGlyph, symbolInstance.isDuplicate);
            if (placeGlyph) {
                collisionIndex.insertCollisionCircles(placedGlyphCircles, layout['text-ignore-placement'], tileID, symbolInstance.textBoxStartIndex);
            }
        }

    }

    if (collisionDebugBoxArray) bucket.collisionBox.collisionVertexBuffer.updateData(collisionDebugBoxArray.serialize());
    if (collisionDebugCircleArray) bucket.collisionCircle.collisionVertexBuffer.updateData(collisionDebugCircleArray.serialize());
}
