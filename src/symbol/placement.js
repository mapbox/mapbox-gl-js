// @flow

const CollisionIndex = require('./collision_index');
const EXTENT = require('../data/extent');
const symbolSize = require('./symbol_size');
const projection = require('./projection');
const symbolLayoutProperties = require('../style/style_layer/symbol_style_layer_properties').layout;
const assert = require('assert');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

import type Transform from '../geo/transform';
import type StyleLayer from '../style/style_layer';
import type Tile from '../source/tile';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type mat4 from '@mapbox/gl-matrix';
import type {CollisionBoxArray, CollisionVertexArray} from '../data/array_types';

class OpacityState {
    opacity: number;
    placed: boolean;
    constructor(prevState: ?OpacityState, increment: number, placed: boolean, skipFade: ?boolean) {
        if (prevState) {
            this.opacity = Math.max(0, Math.min(1, prevState.opacity + (prevState.placed ? increment : -increment)));
        } else {
            this.opacity = (skipFade && placed) ? 1 : 0;
        }
        this.placed = placed;
    }
    isHidden() {
        return this.opacity === 0 && !this.placed;
    }
}

class JointOpacityState {
    text: OpacityState;
    icon: OpacityState;
    constructor(prevState: ?JointOpacityState, increment: number, placedText: boolean, placedIcon: boolean, skipFade: ?boolean) {
        this.text = new OpacityState(prevState ? prevState.text : null, increment, placedText, skipFade);
        this.icon = new OpacityState(prevState ? prevState.icon : null, increment, placedIcon, skipFade);
    }
    isHidden() {
        return this.text.isHidden() && this.icon.isHidden();
    }
}

class JointPlacement {
    text: boolean;
    icon: boolean;
    // skipFade = outside viewport, but within CollisionIndex::viewportPadding px of the edge
    // Because these symbols aren't onscreen yet, we can skip the "fade in" animation,
    // and if a subsequent viewport change brings them into view, they'll be fully
    // visible right away.
    skipFade: boolean;
    constructor(text: boolean, icon: boolean, skipFade: boolean) {
        this.text = text;
        this.icon = icon;
        this.skipFade = skipFade;
    }
}

class Placement {
    transform: Transform;
    collisionIndex: CollisionIndex;
    recentUntil: number;
    placements: { [string | number]: JointPlacement };
    opacities: { [string | number]: JointOpacityState };
    commitTime: number;
    stale: boolean;
    fadeDuration: number;

    constructor(transform: Transform, fadeDuration: number) {
        this.transform = transform.clone();
        this.collisionIndex = new CollisionIndex(this.transform);
        this.recentUntil = -Infinity;
        this.placements = {};
        this.opacities = {};
        this.stale = false;
        this.fadeDuration = fadeDuration;
    }

    placeLayerTile(styleLayer: StyleLayer, tile: Tile, showCollisionBoxes: boolean, seenCrossTileIDs: { [string | number]: boolean }) {
        const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
        if (!symbolBucket) return;

        const layout = symbolBucket.layers[0].layout;

        const scale = Math.pow(2, this.transform.zoom - tile.tileID.overscaledZ);
        const textPixelRatio = tile.tileSize / EXTENT;

        const posMatrix = this.transform.calculatePosMatrix(tile.tileID.toUnwrapped());

        const textLabelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix,
                layout.get('text-pitch-alignment') === 'map',
                layout.get('text-rotation-alignment') === 'map',
                this.transform,
                pixelsToTileUnits(tile, 1, this.transform.zoom));

        const iconLabelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix,
                layout.get('icon-pitch-alignment') === 'map',
                layout.get('icon-rotation-alignment') === 'map',
                this.transform,
                pixelsToTileUnits(tile, 1, this.transform.zoom));

        this.placeLayerBucket(symbolBucket, posMatrix, textLabelPlaneMatrix, iconLabelPlaneMatrix, scale, textPixelRatio,
                showCollisionBoxes, seenCrossTileIDs, tile.collisionBoxArray, tile.tileID.key, styleLayer.source);
    }

    placeLayerBucket(bucket: SymbolBucket, posMatrix: mat4, textLabelPlaneMatrix: mat4, iconLabelPlaneMatrix: mat4,
            scale: number, textPixelRatio: number, showCollisionBoxes: boolean, seenCrossTileIDs: { [string | number]: boolean },
            collisionBoxArray: ?CollisionBoxArray, tileKey: number, sourceID: string) {

        const layout = bucket.layers[0].layout;

        const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, this.transform.zoom, symbolLayoutProperties.properties['text-size']);

        const iconWithoutText = !bucket.hasTextData() || layout.get('text-optional');
        const textWithoutIcon = !bucket.hasIconData() || layout.get('icon-optional');

        for (const symbolInstance of bucket.symbolInstances) {
            if (!seenCrossTileIDs[symbolInstance.crossTileID]) {

                let placeText = false;
                let placeIcon = false;
                let offscreen = true;

                let placedGlyphBoxes = null;
                let placedGlyphCircles = null;
                let placedIconBoxes = null;

                if (!symbolInstance.collisionArrays) {
                    symbolInstance.collisionArrays = bucket.deserializeCollisionBoxes(
                            ((collisionBoxArray: any): CollisionBoxArray),
                            symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex);
                }

                if (symbolInstance.collisionArrays.textBox) {
                    placedGlyphBoxes = this.collisionIndex.placeCollisionBox(symbolInstance.collisionArrays.textBox,
                            layout.get('text-allow-overlap'), textPixelRatio, posMatrix);
                    placeText = placedGlyphBoxes.box.length > 0;
                    offscreen = offscreen && placedGlyphBoxes.offscreen;
                }
                const textCircles = symbolInstance.collisionArrays.textCircles;
                if (textCircles) {
                    const placedSymbol = bucket.text.placedSymbolArray.get(symbolInstance.placedTextSymbolIndices[0]);
                    const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                    placedGlyphCircles = this.collisionIndex.placeCollisionCircles(textCircles,
                            layout.get('text-allow-overlap'),
                            scale,
                            textPixelRatio,
                            symbolInstance.key,
                            placedSymbol,
                            bucket.lineVertexArray,
                            bucket.glyphOffsetArray,
                            fontSize,
                            posMatrix,
                            textLabelPlaneMatrix,
                            showCollisionBoxes,
                            layout.get('text-pitch-alignment') === 'map');
                    // If text-allow-overlap is set, force "placedCircles" to true
                    // In theory there should always be at least one circle placed
                    // in this case, but for now quirks in text-anchor
                    // and text-offset may prevent that from being true.
                    placeText = layout.get('text-allow-overlap') || placedGlyphCircles.circles.length > 0;
                    offscreen = offscreen && placedGlyphCircles.offscreen;
                }

                if (symbolInstance.collisionArrays.iconBox) {
                    placedIconBoxes = this.collisionIndex.placeCollisionBox(symbolInstance.collisionArrays.iconBox,
                            layout.get('icon-allow-overlap'), textPixelRatio, posMatrix);
                    placeIcon = placedIconBoxes.box.length > 0;
                    offscreen = offscreen && placedIconBoxes.offscreen;
                }

                // Combine the scales for icons and text.
                if (!iconWithoutText && !textWithoutIcon) {
                    placeIcon = placeText = placeIcon && placeText;
                } else if (!textWithoutIcon) {
                    placeText = placeIcon && placeText;
                } else if (!iconWithoutText) {
                    placeIcon = placeIcon && placeText;
                }

                if (placeText && placedGlyphBoxes) {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                            tileKey, sourceID, bucket.bucketInstanceId, symbolInstance.textBoxStartIndex);
                }
                if (placeIcon && placedIconBoxes) {
                    this.collisionIndex.insertCollisionBox(placedIconBoxes.box, layout.get('icon-ignore-placement'),
                            tileKey, sourceID, bucket.bucketInstanceId, symbolInstance.iconBoxStartIndex);
                }
                if (placeText && placedGlyphCircles) {
                    this.collisionIndex.insertCollisionCircles(placedGlyphCircles.circles, layout.get('text-ignore-placement'),
                            tileKey, sourceID, bucket.bucketInstanceId, symbolInstance.textBoxStartIndex);
                }

                assert(symbolInstance.crossTileID !== 0);
                assert(bucket.bucketInstanceId !== 0);

                this.placements[symbolInstance.crossTileID] = new JointPlacement(placeText, placeIcon, offscreen || bucket.justReloaded);
                seenCrossTileIDs[symbolInstance.crossTileID] = true;
            }
        }

        bucket.justReloaded = false;
    }

    commit(prevPlacement: ?Placement, now: number) {
        this.commitTime = now;

        let placementChanged = false;

        const increment = (prevPlacement && this.fadeDuration !== 0) ?
            (this.commitTime - prevPlacement.commitTime) / this.fadeDuration :
            1;

        const prevOpacities = prevPlacement ? prevPlacement.opacities : {};

        // add the opacities from the current placement, and copy their current values from the previous placement
        for (const crossTileID in this.placements) {
            const jointPlacement = this.placements[crossTileID];
            const prevOpacity = prevOpacities[crossTileID];
            if (prevOpacity) {
                this.opacities[crossTileID] = new JointOpacityState(prevOpacity, increment, jointPlacement.text, jointPlacement.icon);
                placementChanged = placementChanged ||
                    jointPlacement.text !== prevOpacity.text.placed ||
                    jointPlacement.icon !== prevOpacity.icon.placed;
            } else {
                this.opacities[crossTileID] = new JointOpacityState(null, increment, jointPlacement.text, jointPlacement.icon, jointPlacement.skipFade);
                placementChanged = placementChanged || jointPlacement.text || jointPlacement.icon;
            }
        }

        // copy and update values from the previous placement that aren't in the current placement but haven't finished fading
        for (const crossTileID in prevOpacities) {
            const prevOpacity = prevOpacities[crossTileID];
            if (!this.opacities[crossTileID]) {
                const jointOpacity = new JointOpacityState(prevOpacity, increment, false, false);
                if (!jointOpacity.isHidden()) {
                    this.opacities[crossTileID] = jointOpacity;
                    placementChanged = placementChanged || prevOpacity.text.placed || prevOpacity.icon.placed;
                }
            }
        }

        return placementChanged;
    }

    updateLayerOpacities(styleLayer: StyleLayer, tiles: Array<Tile>) {
        const seenCrossTileIDs = {};

        for (const tile of tiles) {
            const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
            if (symbolBucket) {
                this.updateBucketOpacities(symbolBucket, seenCrossTileIDs, tile.collisionBoxArray);
            }
        }
    }

    updateBucketOpacities(bucket: SymbolBucket, seenCrossTileIDs: { [string | number]: boolean }, collisionBoxArray: ?CollisionBoxArray) {
        if (bucket.hasTextData()) bucket.text.opacityVertexArray.clear();
        if (bucket.hasIconData()) bucket.icon.opacityVertexArray.clear();
        if (bucket.hasCollisionBoxData()) bucket.collisionBox.collisionVertexArray.clear();
        if (bucket.hasCollisionCircleData()) bucket.collisionCircle.collisionVertexArray.clear();

        const layout = bucket.layers[0].layout;
        const defaultOpacityState = new JointOpacityState(null, 0,
                layout.get('text-allow-overlap'),
                layout.get('icon-allow-overlap'), true);

        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances[s];
            const isDuplicate = seenCrossTileIDs[symbolInstance.crossTileID];

            let opacityState = this.opacities[symbolInstance.crossTileID];
            if (!opacityState) {
                opacityState = defaultOpacityState;
                // store the state so that future placements use it as a starting point
                this.opacities[symbolInstance.crossTileID] = opacityState;
            } else if (isDuplicate) {
                opacityState = defaultOpacityState;
            }

            seenCrossTileIDs[symbolInstance.crossTileID] = true;

            const hasText = symbolInstance.numGlyphVertices > 0 || symbolInstance.numVerticalGlyphVertices > 0;
            const hasIcon = symbolInstance.numIconVertices > 0;

            if (hasText) {
                const packedOpacity = packOpacity(opacityState.text);
                // Vertical text fades in/out on collision the same way as corresponding
                // horizontal text. Switch between vertical/horizontal should be instantaneous
                const opacityEntryCount = (symbolInstance.numGlyphVertices + symbolInstance.numVerticalGlyphVertices) / 4;
                for (let i = 0; i < opacityEntryCount; i++) {
                    bucket.text.opacityVertexArray.emplaceBack(packedOpacity);
                }
                for (const placedTextSymbolIndex of symbolInstance.placedTextSymbolIndices) {
                    const placedSymbol = bucket.text.placedSymbolArray.get(placedTextSymbolIndex);
                    // If this label is completely faded, mark it so that we don't have to calculate
                    // its position at render time
                    placedSymbol.hidden = (opacityState.text.isHidden(): any);
                }
            }

            if (hasIcon) {
                const packedOpacity = packOpacity(opacityState.icon);
                for (let i = 0; i < symbolInstance.numIconVertices / 4; i++) {
                    bucket.icon.opacityVertexArray.emplaceBack(packedOpacity);
                }
                const placedSymbol = bucket.icon.placedSymbolArray.get(s);
                placedSymbol.hidden = (opacityState.icon.isHidden(): any);
            }

            if (!symbolInstance.collisionArrays) {
                symbolInstance.collisionArrays = bucket.deserializeCollisionBoxes(
                        ((collisionBoxArray: any): CollisionBoxArray),
                        symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex);
            }

            const collisionArrays = symbolInstance.collisionArrays;
            if (collisionArrays) {
                if (collisionArrays.textBox && bucket.hasCollisionBoxData()) {
                    updateCollisionVertices(bucket.collisionBox.collisionVertexArray, opacityState.text.placed, false);
                }

                if (collisionArrays.iconBox && bucket.hasCollisionBoxData()) {
                    updateCollisionVertices(bucket.collisionBox.collisionVertexArray, opacityState.icon.placed, false);
                }

                const textCircles = collisionArrays.textCircles;
                if (textCircles && bucket.hasCollisionCircleData()) {
                    for (let k = 0; k < textCircles.length; k += 5) {
                        const notUsed = isDuplicate || textCircles[k + 4] === 0;
                        updateCollisionVertices(bucket.collisionCircle.collisionVertexArray, opacityState.text.placed, notUsed);
                    }
                }
            }
        }

        bucket.sortFeatures(this.transform.angle);

        if (bucket.hasTextData() && bucket.text.opacityVertexBuffer) {
            bucket.text.opacityVertexBuffer.updateData(bucket.text.opacityVertexArray);
        }
        if (bucket.hasIconData() && bucket.icon.opacityVertexBuffer) {
            bucket.icon.opacityVertexBuffer.updateData(bucket.icon.opacityVertexArray);
        }
        if (bucket.hasCollisionBoxData() && bucket.collisionBox.collisionVertexBuffer) {
            bucket.collisionBox.collisionVertexBuffer.updateData(bucket.collisionBox.collisionVertexArray);
        }
        if (bucket.hasCollisionCircleData() && bucket.collisionCircle.collisionVertexBuffer) {
            bucket.collisionCircle.collisionVertexBuffer.updateData(bucket.collisionCircle.collisionVertexArray);
        }

        assert(bucket.text.opacityVertexArray.length === bucket.text.layoutVertexArray.length / 4);
        assert(bucket.icon.opacityVertexArray.length === bucket.icon.layoutVertexArray.length / 4);
    }

    symbolFadeChange(now: number) {
        return this.fadeDuration === 0 ?
            1 :
            (now - this.commitTime) / this.fadeDuration;
    }

    hasTransitions(now: number) {
        return this.symbolFadeChange(now) < 1 || this.stale;
    }

    stillRecent(now: number) {
        return this.recentUntil > now;
    }

    setRecent(now: number, stale: boolean) {
        this.stale = stale;
        this.recentUntil = now + this.fadeDuration;
    }

    setStale() {
        this.stale = true;
    }
}

function updateCollisionVertices(collisionVertexArray: CollisionVertexArray, placed: boolean, notUsed: boolean) {
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0);
}

// All four vertices for a glyph will have the same opacity state
// So we pack the opacity into a uint8, and then repeat it four times
// to make a single uint32 that we can upload for each glyph in the
// label.
const shift25 = Math.pow(2, 25);
const shift24 = Math.pow(2, 24);
const shift17 = Math.pow(2, 17);
const shift16 = Math.pow(2, 16);
const shift9 = Math.pow(2, 9);
const shift8 = Math.pow(2, 8);
const shift1 = Math.pow(2, 1);
function packOpacity(opacityState: OpacityState): number {
    if (opacityState.opacity === 0 && !opacityState.placed) {
        return 0;
    } else if (opacityState.opacity === 1 && opacityState.placed) {
        return 4294967295;
    }
    const targetBit = opacityState.placed ? 1 : 0;
    const opacityBits = Math.floor(opacityState.opacity * 127);
    return opacityBits * shift25 + targetBit * shift24 +
        opacityBits * shift17 + targetBit * shift16 +
        opacityBits * shift9 + targetBit * shift8 +
        opacityBits * shift1 + targetBit;
}

module.exports = Placement;
