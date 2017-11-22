// @flow

const symbolSize = require('./symbol_size');
const symbolLayoutProperties = require('../style/style_layer/symbol_style_layer_properties').layout;

import type SymbolBucket, {SymbolInstance} from '../data/bucket/symbol_bucket';
import type OpacityState from './opacity_state';
import type CollisionIndex from './collision_index';
import type CollisionBoxArray from './collision_box';
import type {StructArray} from '../util/struct_array';
const mat4 = require('@mapbox/gl-matrix').mat4;

module.exports = {
    updateOpacities: updateOpacities,
    performSymbolPlacement: performSymbolPlacement
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

const shift25 = Math.pow(2, 25);
const shift24 = Math.pow(2, 24);
const shift17 = Math.pow(2, 17);
const shift16 = Math.pow(2, 16);
const shift9 = Math.pow(2, 9);
const shift8 = Math.pow(2, 8);
const shift1 = Math.pow(2, 1);

// All four vertices for a glyph will have the same opacity state
// So we pack the opacity into a uint8, and then repeat it four times
// to make a single uint32 that we can upload for each glyph in the
// label.
function packOpacity(opacityState: OpacityState): number {
    if (opacityState.opacity === 0 && opacityState.targetOpacity === 0) {
        return 0;
    } else if (opacityState.opacity === 1 && opacityState.targetOpacity === 1) {
        return 4294967295;
    }
    const targetBit = opacityState.targetOpacity === 1 ? 1 : 0;
    const opacityBits = Math.floor(opacityState.opacity * 127);
    return opacityBits * shift25 + targetBit * shift24 +
        opacityBits * shift17 + targetBit * shift16 +
        opacityBits * shift9 + targetBit * shift8 +
        opacityBits * shift1 + targetBit;
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
            const initialHidden = opacityState.opacity === 0 && opacityState.targetOpacity === 0;
            updateOpacity(symbolInstance, opacityState, targetOpacity, bucket.fadeStartTime, collisionFadeTimes);
            const nowHidden = opacityState.opacity === 0 && opacityState.targetOpacity === 0;
            if (initialHidden !== nowHidden) {
                for (const placedTextSymbolIndex of symbolInstance.placedTextSymbolIndices) {
                    const placedSymbol = (bucket.placedGlyphArray.get(placedTextSymbolIndex): any);
                    // If this label is completely faded, mark it so that we don't have to calculate
                    // its position at render time
                    placedSymbol.hidden = nowHidden;
                }
            }

            // Vertical text fades in/out on collision the same way as corresponding
            // horizontal text. Switch between vertical/horizontal should be instantaneous
            const opacityEntryCount = (symbolInstance.numGlyphVertices + symbolInstance.numVerticalGlyphVertices) / 4;
            const packedOpacity = packOpacity(opacityState);
            for (let i = 0; i < opacityEntryCount; i++) {
                glyphOpacityArray.emplaceBack(packedOpacity);
            }
        }

        if (hasIcon) {
            const targetOpacity = symbolInstance.placedIcon ? 1.0 : 0.0;
            const opacityState = symbolInstance.iconOpacityState;
            updateOpacity(symbolInstance, opacityState, targetOpacity, bucket.fadeStartTime, collisionFadeTimes);
            const opacityEntryCount = symbolInstance.numIconVertices / 4;
            const packedOpacity = packOpacity(opacityState);
            for (let i = 0; i < opacityEntryCount; i++) {
                iconOpacityArray.emplaceBack(packedOpacity);
            }
        }

    }

    if (glyphOpacityArray && bucket.text.opacityVertexBuffer) {
        bucket.text.opacityVertexBuffer.updateData(glyphOpacityArray.serialize());
    }
    if (iconOpacityArray && bucket.icon.opacityVertexBuffer) {
        bucket.icon.opacityVertexBuffer.updateData(iconOpacityArray.serialize());
    }
}


function updateCollisionBox(collisionVertexArray: StructArray, placed: boolean) {
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, 0);
}

function updateCollisionCircles(collisionVertexArray: StructArray, collisionCircles: Array<any>, placed: boolean, isDuplicate: boolean) {
    for (let k = 0; k < collisionCircles.length; k += 5) {
        const notUsed = isDuplicate || (collisionCircles[k + 4] === 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
        collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    }
}

function performSymbolPlacement(bucket: SymbolBucket, collisionIndex: CollisionIndex, showCollisionBoxes: boolean, zoom: number, textPixelRatio: number, posMatrix: mat4, labelPlaneMatrix: mat4, tileID: number, sourceID: string, collisionBoxArray: CollisionBoxArray) {
    const layer = bucket.layers[0];
    const layout = layer.layout;

    const scale = Math.pow(2, zoom - bucket.zoom);

    let collisionDebugBoxArray, collisionDebugCircleArray;
    if (showCollisionBoxes) {
        if (bucket.collisionBox && bucket.collisionBox.collisionVertexArray && bucket.collisionBox.collisionVertexArray.length) {
            collisionDebugBoxArray = bucket.collisionBox.collisionVertexArray;
            collisionDebugBoxArray.clear();
        }

        if (bucket.collisionCircle && bucket.collisionCircle.collisionVertexArray && bucket.collisionCircle.collisionVertexArray.length) {
            collisionDebugCircleArray = bucket.collisionCircle.collisionVertexArray;
            collisionDebugCircleArray.clear();
        }
    }

    const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, collisionIndex.transform.zoom,
        symbolLayoutProperties.properties['text-size']);
    const pitchWithMap = layout.get('text-pitch-alignment') === 'map';

    for (const symbolInstance of bucket.symbolInstances) {

        const hasText = !(symbolInstance.textBoxStartIndex === symbolInstance.textBoxEndIndex);
        const hasIcon = !(symbolInstance.iconBoxStartIndex === symbolInstance.iconBoxEndIndex);

        const iconWithoutText = layout.get('text-optional') || !hasText,
            textWithoutIcon = layout.get('icon-optional') || !hasIcon;

        if (!symbolInstance.collisionArrays) {
            symbolInstance.collisionArrays = bucket.deserializeCollisionBoxes(collisionBoxArray, symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex);
        }

        let placedGlyphBox = [];
        let placedIconBox = [];
        let placedGlyphCircles = [];
        let placedCircles = false;
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
                    layout.get('text-allow-overlap'), textPixelRatio, posMatrix);
            }

            if (symbolInstance.collisionArrays.iconBox) {
                placedIconBox = collisionIndex.placeCollisionBox(symbolInstance.collisionArrays.iconBox,
                    layout.get('icon-allow-overlap'), textPixelRatio, posMatrix);
            }

            const textCircles = symbolInstance.collisionArrays.textCircles;
            if (textCircles) {
                const placedSymbol = (bucket.placedGlyphArray.get(symbolInstance.placedTextSymbolIndices[0]): any);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                placedGlyphCircles = collisionIndex.placeCollisionCircles(textCircles,
                    layout.get('text-allow-overlap'),
                    scale,
                    textPixelRatio,
                    symbolInstance.key,
                    placedSymbol,
                    bucket.lineVertexArray,
                    bucket.glyphOffsetArray,
                    fontSize,
                    posMatrix,
                    labelPlaneMatrix,
                    showCollisionBoxes,
                    pitchWithMap);
                // If text-allow-overlap is set, force "placedCircles" to true
                // In theory there should always be at least one circle placed
                // in this case, but for now quirks in text-anchor
                // and text-offset may prevent that from being true.
                placedCircles = layout.get('text-allow-overlap') || placedGlyphCircles.length > 0;
            }
        }

        let placeGlyph = placedGlyphBox.length > 0 || placedCircles;
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
            if (collisionDebugBoxArray) {
                updateCollisionBox(collisionDebugBoxArray, placeGlyph);
            }
            if (placeGlyph) {
                collisionIndex.insertCollisionBox(placedGlyphBox, layout.get('text-ignore-placement'), tileID, sourceID, symbolInstance.textBoxStartIndex);
            }
        }
        if (symbolInstance.collisionArrays.iconBox) {
            if (collisionDebugBoxArray) {
                updateCollisionBox(collisionDebugBoxArray, placeIcon);
            }
            if (placeIcon) {
                collisionIndex.insertCollisionBox(placedIconBox, layout.get('icon-ignore-placement'), tileID, sourceID, symbolInstance.iconBoxStartIndex);
            }
        }
        if (symbolInstance.collisionArrays.textCircles) {
            if (collisionDebugCircleArray) {
                updateCollisionCircles(collisionDebugCircleArray, symbolInstance.collisionArrays.textCircles, placeGlyph, symbolInstance.isDuplicate);
            }
            if (placeGlyph) {
                collisionIndex.insertCollisionCircles(placedGlyphCircles, layout.get('text-ignore-placement'), tileID, sourceID, symbolInstance.textBoxStartIndex);
            }
        }

    }

    // If the buffer hasn't been uploaded for the first time yet, we don't need to call updateData since it will happen at upload time
    if (collisionDebugBoxArray && bucket.collisionBox.collisionVertexBuffer)
        bucket.collisionBox.collisionVertexBuffer.updateData(collisionDebugBoxArray.serialize());
    if (collisionDebugCircleArray && bucket.collisionCircle.collisionVertexBuffer)
        bucket.collisionCircle.collisionVertexBuffer.updateData(collisionDebugCircleArray.serialize());
}
