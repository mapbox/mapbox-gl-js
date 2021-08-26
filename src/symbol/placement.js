// @flow

import CollisionIndex from './collision_index.js';
import EXTENT from '../data/extent.js';
import ONE_EM from './one_em.js';
import * as symbolSize from './symbol_size.js';
import * as projection from './projection.js';
import {getAnchorJustification, evaluateVariableOffset} from './symbol_layout.js';
import {getAnchorAlignment, WritingMode} from './shaping.js';
import {mat4} from 'gl-matrix';
import assert from 'assert';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import Point from '@mapbox/point-geometry';
import type Transform from '../geo/transform.js';
import type StyleLayer from '../style/style_layer.js';
import type Tile from '../source/tile.js';
import type SymbolBucket, {CollisionArrays, SingleCollisionBox} from '../data/bucket/symbol_bucket.js';
import type {CollisionBoxArray, CollisionVertexArray, SymbolInstance} from '../data/array_types.js';
import type FeatureIndex from '../data/feature_index.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import type {TextAnchor} from './symbol_layout.js';
import type {FogState} from '../style/fog_helpers.js';

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

class CollisionCircleArray {
    // Stores collision circles and placement matrices of a bucket for debug rendering.
    invProjMatrix: mat4;
    viewportMatrix: mat4;
    circles: Array<number>;

    constructor() {
        this.invProjMatrix = mat4.create();
        this.viewportMatrix = mat4.create();
        this.circles = [];
    }
}

export class RetainedQueryData {
    bucketInstanceId: number;
    featureIndex: FeatureIndex;
    sourceLayerIndex: number;
    bucketIndex: number;
    tileID: OverscaledTileID;
    featureSortOrder: ?Array<number>
    constructor(bucketInstanceId: number,
                featureIndex: FeatureIndex,
                sourceLayerIndex: number,
                bucketIndex: number,
                tileID: OverscaledTileID) {
        this.bucketInstanceId = bucketInstanceId;
        this.featureIndex = featureIndex;
        this.sourceLayerIndex = sourceLayerIndex;
        this.bucketIndex = bucketIndex;
        this.tileID = tileID;
    }
}

type CollisionGroup = { ID: number, predicate?: any };

class CollisionGroups {
    collisionGroups: {[groupName: string]: CollisionGroup};
    maxGroupID: number;
    crossSourceCollisions: boolean;

    constructor(crossSourceCollisions: boolean) {
        this.crossSourceCollisions = crossSourceCollisions;
        this.maxGroupID = 0;
        this.collisionGroups = {};
    }

    get(sourceID: string) {
        // The predicate/groupID mechanism allows for arbitrary grouping,
        // but the current interface defines one source == one group when
        // crossSourceCollisions == true.
        if (!this.crossSourceCollisions) {
            if (!this.collisionGroups[sourceID]) {
                const nextGroupID = ++this.maxGroupID;
                this.collisionGroups[sourceID] = {
                    ID: nextGroupID,
                    predicate: (key) => {
                        return key.collisionGroupID === nextGroupID;
                    }
                };
            }
            return this.collisionGroups[sourceID];
        } else {
            return {ID: 0, predicate: null};
        }
    }
}

function calculateVariableLayoutShift(anchor: TextAnchor, width: number, height: number, textOffset: [number, number], textScale: number): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const offset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        shiftX + offset[0] * textScale,
        shiftY + offset[1] * textScale
    );
}

function offsetShift(shiftX: number, shiftY: number, rotateWithMap: boolean, pitchWithMap: boolean, angle: number): Point {
    const shift = new Point(shiftX, shiftY);
    if (rotateWithMap) {
        shift._rotate(pitchWithMap ? angle : -angle);
    }
    return shift;
}

export type VariableOffset = {
    textOffset: [number, number],
    width: number,
    height: number,
    anchor: TextAnchor,
    textScale: number,
    prevAnchor?: TextAnchor
};

type TileLayerParameters = {
    bucket: SymbolBucket,
    layout: any,
    posMatrix: mat4,
    textLabelPlaneMatrix: mat4,
    labelToScreenMatrix: mat4,
    scale: number,
    textPixelRatio: number,
    holdingForFade: boolean,
    collisionBoxArray: ?CollisionBoxArray,
    partiallyEvaluatedTextSize: any,
    collisionGroup: any
};

export type BucketPart = {
    sortKey?: number | void,
    symbolInstanceStart: number,
    symbolInstanceEnd: number,
    parameters: TileLayerParameters
};

export type CrossTileID = string | number;

export class Placement {
    transform: Transform;
    collisionIndex: CollisionIndex;
    placements: { [_: CrossTileID]: JointPlacement };
    opacities: { [_: CrossTileID]: JointOpacityState };
    variableOffsets: {[_: CrossTileID]: VariableOffset };
    placedOrientations: {[_: CrossTileID]: number };
    commitTime: number;
    prevZoomAdjustment: number;
    lastPlacementChangeTime: number;
    stale: boolean;
    fadeDuration: number;
    retainedQueryData: {[_: number]: RetainedQueryData};
    collisionGroups: CollisionGroups;
    prevPlacement: ?Placement;
    zoomAtLastRecencyCheck: number;
    collisionCircleArrays: {[any]: CollisionCircleArray};

    constructor(transform: Transform, fadeDuration: number, crossSourceCollisions: boolean, prevPlacement?: Placement, fogState: ?FogState) {
        this.transform = transform.clone();
        this.collisionIndex = new CollisionIndex(this.transform, fogState);
        this.placements = {};
        this.opacities = {};
        this.variableOffsets = {};
        this.stale = false;
        this.commitTime = 0;
        this.fadeDuration = fadeDuration;
        this.retainedQueryData = {};
        this.collisionGroups = new CollisionGroups(crossSourceCollisions);
        this.collisionCircleArrays = {};

        this.prevPlacement = prevPlacement;
        if (prevPlacement) {
            prevPlacement.prevPlacement = undefined; // Only hold on to one placement back
        }

        this.placedOrientations = {};
    }

    getBucketParts(results: Array<BucketPart>, styleLayer: StyleLayer, tile: Tile, sortAcrossTiles: boolean) {
        const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
        const bucketFeatureIndex = tile.latestFeatureIndex;
        if (!symbolBucket || !bucketFeatureIndex || styleLayer.id !== symbolBucket.layerIds[0])
            return;

        const collisionBoxArray = tile.collisionBoxArray;

        const layout = symbolBucket.layers[0].layout;

        const scale = Math.pow(2, this.transform.zoom - tile.tileID.overscaledZ);
        const textPixelRatio = tile.tileSize / EXTENT;

        const posMatrix = this.transform.calculateProjMatrix(tile.tileID.toUnwrapped());

        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pixelsToTiles = pixelsToTileUnits(tile, 1, this.transform.zoom);

        const textLabelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                pixelsToTiles);

        let labelToScreenMatrix = null;

        if (pitchWithMap) {
            const glMatrix = projection.getGlCoordMatrix(
                posMatrix,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                pixelsToTiles);

            labelToScreenMatrix = mat4.multiply([], this.transform.labelPlaneMatrix, glMatrix);
        }

        // As long as this placement lives, we have to hold onto this bucket's
        // matching FeatureIndex/data for querying purposes
        this.retainedQueryData[symbolBucket.bucketInstanceId] = new RetainedQueryData(
            symbolBucket.bucketInstanceId,
            bucketFeatureIndex,
            symbolBucket.sourceLayerIndex,
            symbolBucket.index,
            tile.tileID
        );

        const parameters = {
            bucket: symbolBucket,
            layout,
            posMatrix,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            scale,
            textPixelRatio,
            holdingForFade: tile.holdingForFade(),
            collisionBoxArray,
            partiallyEvaluatedTextSize: symbolSize.evaluateSizeForZoom(symbolBucket.textSizeData, this.transform.zoom),
            partiallyEvaluatedIconSize: symbolSize.evaluateSizeForZoom(symbolBucket.iconSizeData, this.transform.zoom),
            collisionGroup: this.collisionGroups.get(symbolBucket.sourceID)
        };

        if (sortAcrossTiles) {
            for (const range of symbolBucket.sortKeyRanges) {
                const {sortKey, symbolInstanceStart, symbolInstanceEnd} = range;
                results.push({sortKey, symbolInstanceStart, symbolInstanceEnd, parameters});
            }
        } else {
            results.push({
                symbolInstanceStart: 0,
                symbolInstanceEnd: symbolBucket.symbolInstances.length,
                parameters
            });
        }
    }

    attemptAnchorPlacement(anchor: TextAnchor, textBox: SingleCollisionBox, width: number, height: number,
                           textScale: number, rotateWithMap: boolean, pitchWithMap: boolean, textPixelRatio: number,
                           posMatrix: mat4, collisionGroup: CollisionGroup, textAllowOverlap: boolean,
                           symbolInstance: SymbolInstance, symbolIndex: number, bucket: SymbolBucket,
                           orientation: number, iconBox: ?SingleCollisionBox, textSize: any, iconSize: any): ?{ shift: Point, placedGlyphBoxes: { box: Array<number>, offscreen: boolean } }  {

        const textOffset = [symbolInstance.textOffset0, symbolInstance.textOffset1];
        const shift = calculateVariableLayoutShift(anchor, width, height, textOffset, textScale);

        const placedGlyphBoxes = this.collisionIndex.placeCollisionBox(
            textScale, textBox, offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle),
            textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);

        if (iconBox) {
            const placedIconBoxes = this.collisionIndex.placeCollisionBox(
                bucket.getSymbolInstanceIconSize(iconSize, this.transform.zoom, symbolIndex),
                iconBox, offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle),
                textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
            if (placedIconBoxes.box.length === 0) return;
        }

        if (placedGlyphBoxes.box.length > 0) {
            let prevAnchor;
            // If this label was placed in the previous placement, record the anchor position
            // to allow us to animate the transition
            if (this.prevPlacement &&
                this.prevPlacement.variableOffsets[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID].text) {
                prevAnchor = this.prevPlacement.variableOffsets[symbolInstance.crossTileID].anchor;
            }
            assert(symbolInstance.crossTileID !== 0);
            this.variableOffsets[symbolInstance.crossTileID] = {
                textOffset,
                width,
                height,
                anchor,
                textScale,
                prevAnchor
            };
            this.markUsedJustification(bucket, anchor, symbolInstance, orientation);

            if (bucket.allowVerticalPlacement) {
                this.markUsedOrientation(bucket, orientation, symbolInstance);
                this.placedOrientations[symbolInstance.crossTileID] = orientation;
            }

            return {shift, placedGlyphBoxes};
        }
    }

    placeLayerBucketPart(bucketPart: Object, seenCrossTileIDs: { [string | number]: boolean }, showCollisionBoxes: boolean, updateCollisionBoxIfNecessary: boolean) {

        const {
            bucket,
            layout,
            posMatrix,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            textPixelRatio,
            holdingForFade,
            collisionBoxArray,
            partiallyEvaluatedTextSize,
            partiallyEvaluatedIconSize,
            collisionGroup
        } = bucketPart.parameters;

        const textOptional = layout.get('text-optional');
        const iconOptional = layout.get('icon-optional');
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        const zOrderByViewportY = layout.get('symbol-z-order') === 'viewport-y';

        // This logic is similar to the "defaultOpacityState" logic below in updateBucketOpacities
        // If we know a symbol is always supposed to show, force it to be marked visible even if
        // it wasn't placed into the collision index (because some or all of it was outside the range
        // of the collision grid).
        // There is a subtle edge case here we're accepting:
        //  Symbol A has text-allow-overlap: true, icon-allow-overlap: true, icon-optional: false
        //  A's icon is outside the grid, so doesn't get placed
        //  A's text would be inside grid, but doesn't get placed because of icon-optional: false
        //  We still show A because of the allow-overlap settings.
        //  Symbol B has allow-overlap: false, and gets placed where A's text would be
        //  On panning in, there is a short period when Symbol B and Symbol A will overlap
        //  This is the reverse of our normal policy of "fade in on pan", but should look like any other
        //  collision and hopefully not be too noticeable.
        // See https://github.com/mapbox/mapbox-gl-js/issues/7172
        const alwaysShowText = textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || iconOptional);
        const alwaysShowIcon = iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || textOptional);

        if (!bucket.collisionArrays && collisionBoxArray) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        if (showCollisionBoxes && updateCollisionBoxIfNecessary) {
            bucket.updateCollisionDebugBuffers(this.transform.zoom, collisionBoxArray);
        }

        const placeSymbol = (symbolInstance: SymbolInstance, symbolIndex: number, collisionArrays: CollisionArrays) => {
            if (seenCrossTileIDs[symbolInstance.crossTileID]) return;
            if (holdingForFade) {
                // Mark all symbols from this tile as "not placed", but don't add to seenCrossTileIDs, because we don't
                // know yet if we have a duplicate in a parent tile that _should_ be placed.
                this.placements[symbolInstance.crossTileID] = new JointPlacement(false, false, false);
                return;
            }

            let placeText = false;
            let placeIcon = false;
            let offscreen = true;
            let shift = null;

            let placed = {box: null, offscreen: null};
            let placedVerticalText = {box: null, offscreen: null};

            let placedGlyphBoxes = null;
            let placedGlyphCircles = null;
            let placedIconBoxes = null;
            let textFeatureIndex = 0;
            let verticalTextFeatureIndex = 0;
            let iconFeatureIndex = 0;

            if (collisionArrays.textFeatureIndex) {
                textFeatureIndex = collisionArrays.textFeatureIndex;
            } else if (symbolInstance.useRuntimeCollisionCircles) {
                textFeatureIndex = symbolInstance.featureIndex;
            }
            if (collisionArrays.verticalTextFeatureIndex) {
                verticalTextFeatureIndex = collisionArrays.verticalTextFeatureIndex;
            }

            const updateBoxData = (box: SingleCollisionBox) => {
                box.tileID = this.retainedQueryData[bucket.bucketInstanceId].tileID;
                if (!this.transform.elevation && !box.elevation) return;
                box.elevation = this.transform.elevation ? this.transform.elevation.getAtTileOffset(
                    this.retainedQueryData[bucket.bucketInstanceId].tileID,
                    box.tileAnchorX, box.tileAnchorY) : 0;
            };

            const textBox = collisionArrays.textBox;
            if (textBox) {
                updateBoxData(textBox);
                const updatePreviousOrientationIfNotPlaced = (isPlaced) => {
                    let previousOrientation = WritingMode.horizontal;
                    if (bucket.allowVerticalPlacement && !isPlaced && this.prevPlacement) {
                        const prevPlacedOrientation = this.prevPlacement.placedOrientations[symbolInstance.crossTileID];
                        if (prevPlacedOrientation) {
                            this.placedOrientations[symbolInstance.crossTileID] = prevPlacedOrientation;
                            previousOrientation = prevPlacedOrientation;
                            this.markUsedOrientation(bucket, previousOrientation, symbolInstance);
                        }
                    }
                    return previousOrientation;
                };

                const placeTextForPlacementModes = (placeHorizontalFn, placeVerticalFn) => {
                    if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && collisionArrays.verticalTextBox) {
                        for (const placementMode of bucket.writingModes) {
                            if (placementMode === WritingMode.vertical) {
                                placed = placeVerticalFn();
                                placedVerticalText = placed;
                            } else {
                                placed = placeHorizontalFn();
                            }
                            if (placed && placed.box && placed.box.length) break;
                        }
                    } else {
                        placed = placeHorizontalFn();
                    }
                };

                if (!layout.get('text-variable-anchor')) {
                    const placeBox = (collisionTextBox, orientation) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, this.transform.zoom, symbolIndex);
                        const placedFeature = this.collisionIndex.placeCollisionBox(textScale, collisionTextBox,
                            new Point(0, 0), textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
                        if (placedFeature && placedFeature.box && placedFeature.box.length) {
                            this.markUsedOrientation(bucket, orientation, symbolInstance);
                            this.placedOrientations[symbolInstance.crossTileID] = orientation;
                        }
                        return placedFeature;
                    };

                    const placeHorizontal = () => {
                        return placeBox(textBox, WritingMode.horizontal);
                    };

                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            updateBoxData(verticalTextBox);
                            return placeBox(verticalTextBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);
                    updatePreviousOrientationIfNotPlaced(placed && placed.box && placed.box.length);

                } else {
                    let anchors = layout.get('text-variable-anchor');

                    // If this symbol was in the last placement, shift the previously used
                    // anchor to the front of the anchor list, only if the previous anchor
                    // is still in the anchor list
                    if (this.prevPlacement && this.prevPlacement.variableOffsets[symbolInstance.crossTileID]) {
                        const prevOffsets = this.prevPlacement.variableOffsets[symbolInstance.crossTileID];
                        if (anchors.indexOf(prevOffsets.anchor) > 0) {
                            anchors = anchors.filter(anchor => anchor !== prevOffsets.anchor);
                            anchors.unshift(prevOffsets.anchor);
                        }
                    }

                    const placeBoxForVariableAnchors = (collisionTextBox, collisionIconBox, orientation) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, this.transform.zoom, symbolIndex);
                        const width = (collisionTextBox.x2 - collisionTextBox.x1) * textScale + 2.0 * collisionTextBox.padding;
                        const height = (collisionTextBox.y2 - collisionTextBox.y1) * textScale + 2.0 * collisionTextBox.padding;

                        const variableIconBox = hasIconTextFit && !iconAllowOverlap ? collisionIconBox : null;
                        if (variableIconBox) updateBoxData(variableIconBox);

                        let placedBox: ?{ box: Array<number>, offscreen: boolean }  = {box: [], offscreen: false};
                        const placementAttempts = textAllowOverlap ? anchors.length * 2 : anchors.length;
                        for (let i = 0; i < placementAttempts; ++i) {
                            const anchor = anchors[i % anchors.length];
                            const allowOverlap = (i >= anchors.length);
                            const result = this.attemptAnchorPlacement(
                                anchor, collisionTextBox, width, height, textScale, rotateWithMap,
                                pitchWithMap, textPixelRatio, posMatrix, collisionGroup, allowOverlap,
                                symbolInstance, symbolIndex, bucket, orientation, variableIconBox,
                                partiallyEvaluatedTextSize, partiallyEvaluatedIconSize);

                            if (result) {
                                placedBox = result.placedGlyphBoxes;
                                if (placedBox && placedBox.box && placedBox.box.length) {
                                    placeText = true;
                                    shift = result.shift;
                                    break;
                                }
                            }
                        }

                        return placedBox;
                    };

                    const placeHorizontal = () => {
                        return placeBoxForVariableAnchors(textBox, collisionArrays.iconBox, WritingMode.horizontal);
                    };

                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (verticalTextBox) updateBoxData(verticalTextBox);
                        const wasPlaced = placed && placed.box && placed.box.length;
                        if (bucket.allowVerticalPlacement && !wasPlaced && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBoxForVariableAnchors(verticalTextBox, collisionArrays.verticalIconBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);

                    if (placed) {
                        placeText = placed.box;
                        offscreen = placed.offscreen;
                    }

                    const prevOrientation = updatePreviousOrientationIfNotPlaced(placed && placed.box);

                    // If we didn't get placed, we still need to copy our position from the last placement for
                    // fade animations
                    if (!placeText && this.prevPlacement) {
                        const prevOffset = this.prevPlacement.variableOffsets[symbolInstance.crossTileID];
                        if (prevOffset) {
                            this.variableOffsets[symbolInstance.crossTileID] = prevOffset;
                            this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, prevOrientation);
                        }
                    }

                }
            }

            placedGlyphBoxes = placed;
            placeText = placedGlyphBoxes && placedGlyphBoxes.box && placedGlyphBoxes.box.length > 0;

            offscreen = placedGlyphBoxes && placedGlyphBoxes.offscreen;

            if (symbolInstance.useRuntimeCollisionCircles) {
                const placedSymbolIndex = symbolInstance.centerJustifiedTextSymbolIndex >= 0 ? symbolInstance.centerJustifiedTextSymbolIndex : symbolInstance.verticalPlacedTextSymbolIndex;
                const placedSymbol = bucket.text.placedSymbolArray.get(placedSymbolIndex);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);

                const textPixelPadding = layout.get('text-padding');
                // Convert circle collision height into pixels
                const circlePixelDiameter = symbolInstance.collisionCircleDiameter * fontSize / ONE_EM;

                placedGlyphCircles = this.collisionIndex.placeCollisionCircles(textAllowOverlap,
                        placedSymbol,
                        bucket.lineVertexArray,
                        bucket.glyphOffsetArray,
                        fontSize,
                        posMatrix,
                        textLabelPlaneMatrix,
                        labelToScreenMatrix,
                        showCollisionBoxes,
                        pitchWithMap,
                        collisionGroup.predicate,
                        circlePixelDiameter,
                        textPixelPadding,
                        this.retainedQueryData[bucket.bucketInstanceId].tileID);

                assert(!placedGlyphCircles.circles.length || (!placedGlyphCircles.collisionDetected || showCollisionBoxes));
                // If text-allow-overlap is set, force "placedCircles" to true
                // In theory there should always be at least one circle placed
                // in this case, but for now quirks in text-anchor
                // and text-offset may prevent that from being true.
                placeText = textAllowOverlap || (placedGlyphCircles.circles.length > 0 && !placedGlyphCircles.collisionDetected);
                offscreen = offscreen && placedGlyphCircles.offscreen;
            }

            if (collisionArrays.iconFeatureIndex) {
                iconFeatureIndex = collisionArrays.iconFeatureIndex;
            }

            if (collisionArrays.iconBox) {

                const placeIconFeature = iconBox => {
                    updateBoxData(iconBox);
                    const shiftPoint: Point = hasIconTextFit && shift ?
                        offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle) :
                        new Point(0, 0);

                    const iconScale = bucket.getSymbolInstanceIconSize(partiallyEvaluatedIconSize, this.transform.zoom, symbolIndex);
                    return this.collisionIndex.placeCollisionBox(iconScale, iconBox, shiftPoint,
                        iconAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
                };

                if (placedVerticalText && placedVerticalText.box && placedVerticalText.box.length && collisionArrays.verticalIconBox) {
                    placedIconBoxes = placeIconFeature(collisionArrays.verticalIconBox);
                    placeIcon = placedIconBoxes.box.length > 0;
                } else {
                    placedIconBoxes = placeIconFeature(collisionArrays.iconBox);
                    placeIcon = placedIconBoxes.box.length > 0;
                }
                offscreen = offscreen && placedIconBoxes.offscreen;
            }

            const iconWithoutText = textOptional ||
                (symbolInstance.numHorizontalGlyphVertices === 0 && symbolInstance.numVerticalGlyphVertices === 0);
            const textWithoutIcon = iconOptional || symbolInstance.numIconVertices === 0;

            // Combine the scales for icons and text.
            if (!iconWithoutText && !textWithoutIcon) {
                placeIcon = placeText = placeIcon && placeText;
            } else if (!textWithoutIcon) {
                placeText = placeIcon && placeText;
            } else if (!iconWithoutText) {
                placeIcon = placeIcon && placeText;
            }

            if (placeText && placedGlyphBoxes && placedGlyphBoxes.box) {
                if (placedVerticalText && placedVerticalText.box && verticalTextFeatureIndex) {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, verticalTextFeatureIndex, collisionGroup.ID);
                } else {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }

            }
            if (placeIcon && placedIconBoxes) {
                this.collisionIndex.insertCollisionBox(placedIconBoxes.box, layout.get('icon-ignore-placement'),
                        bucket.bucketInstanceId, iconFeatureIndex, collisionGroup.ID);
            }
            if (placedGlyphCircles) {
                if (placeText) {
                    this.collisionIndex.insertCollisionCircles(placedGlyphCircles.circles, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }

                if (showCollisionBoxes) {
                    const id = bucket.bucketInstanceId;
                    let circleArray = this.collisionCircleArrays[id];

                    // Group collision circles together by bucket. Circles can't be pushed forward for rendering yet as the symbol placement
                    // for a bucket is not guaranteed to be complete before the commit-function has been called
                    if (circleArray === undefined)
                        circleArray = this.collisionCircleArrays[id] = new CollisionCircleArray();

                    for (let i = 0; i < placedGlyphCircles.circles.length; i += 4) {
                        circleArray.circles.push(placedGlyphCircles.circles[i + 0]);              // x
                        circleArray.circles.push(placedGlyphCircles.circles[i + 1]);              // y
                        circleArray.circles.push(placedGlyphCircles.circles[i + 2]);              // radius
                        circleArray.circles.push(placedGlyphCircles.collisionDetected ? 1 : 0);   // collisionDetected-flag
                    }
                }
            }

            assert(symbolInstance.crossTileID !== 0);
            assert(bucket.bucketInstanceId !== 0);

            this.placements[symbolInstance.crossTileID] = new JointPlacement(placeText || alwaysShowText, placeIcon || alwaysShowIcon, offscreen || bucket.justReloaded);
            seenCrossTileIDs[symbolInstance.crossTileID] = true;
        };

        if (zOrderByViewportY) {
            assert(bucketPart.symbolInstanceStart === 0);
            const symbolIndexes = bucket.getSortedSymbolIndexes(this.transform.angle);
            for (let i = symbolIndexes.length - 1; i >= 0; --i) {
                const symbolIndex = symbolIndexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), symbolIndex, bucket.collisionArrays[symbolIndex]);
            }
        } else {
            for (let i = bucketPart.symbolInstanceStart; i < bucketPart.symbolInstanceEnd; i++) {
                placeSymbol(bucket.symbolInstances.get(i), i, bucket.collisionArrays[i]);
            }
        }

        if (showCollisionBoxes && bucket.bucketInstanceId in this.collisionCircleArrays) {
            const circleArray = this.collisionCircleArrays[bucket.bucketInstanceId];

            // Store viewport and inverse projection matrices per bucket
            mat4.invert(circleArray.invProjMatrix, posMatrix);
            circleArray.viewportMatrix = this.collisionIndex.getViewportMatrix();
        }

        bucket.justReloaded = false;
    }

    markUsedJustification(bucket: SymbolBucket, placedAnchor: TextAnchor, symbolInstance: SymbolInstance, orientation: number) {
        const justifications = {
            "left": symbolInstance.leftJustifiedTextSymbolIndex,
            "center": symbolInstance.centerJustifiedTextSymbolIndex,
            "right": symbolInstance.rightJustifiedTextSymbolIndex
        };

        let autoIndex;
        if (orientation === WritingMode.vertical) {
            autoIndex = symbolInstance.verticalPlacedTextSymbolIndex;
        } else {
            autoIndex = justifications[getAnchorJustification(placedAnchor)];
        }

        const indexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex,
            symbolInstance.verticalPlacedTextSymbolIndex
        ];

        for (const index of indexes) {
            if (index >= 0) {
                if (autoIndex >= 0 && index !== autoIndex) {
                    // There are multiple justifications and this one isn't it: shift offscreen
                    bucket.text.placedSymbolArray.get(index).crossTileID = 0;
                } else {
                    // Either this is the chosen justification or the justification is hardwired: use this one
                    bucket.text.placedSymbolArray.get(index).crossTileID = symbolInstance.crossTileID;
                }
            }
        }
    }

    markUsedOrientation(bucket: SymbolBucket, orientation: number, symbolInstance: SymbolInstance) {
        const horizontal = (orientation === WritingMode.horizontal || orientation === WritingMode.horizontalOnly) ? orientation : 0;
        const vertical = orientation === WritingMode.vertical ? orientation : 0;

        const horizontalIndexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex
        ];

        for (const index of horizontalIndexes) {
            bucket.text.placedSymbolArray.get(index).placedOrientation = horizontal;
        }

        if (symbolInstance.verticalPlacedTextSymbolIndex) {
            bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).placedOrientation = vertical;
        }
    }

    commit(now: number): void {
        this.commitTime = now;
        this.zoomAtLastRecencyCheck = this.transform.zoom;

        const prevPlacement = this.prevPlacement;
        let placementChanged = false;

        this.prevZoomAdjustment = prevPlacement ? prevPlacement.zoomAdjustment(this.transform.zoom) : 0;
        const increment = prevPlacement ? prevPlacement.symbolFadeChange(now) : 1;

        const prevOpacities = prevPlacement ? prevPlacement.opacities : {};
        const prevOffsets = prevPlacement ? prevPlacement.variableOffsets : {};
        const prevOrientations = prevPlacement ? prevPlacement.placedOrientations : {};

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
        for (const crossTileID in prevOffsets) {
            if (!this.variableOffsets[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.variableOffsets[crossTileID] = prevOffsets[crossTileID];
            }
        }

        for (const crossTileID in prevOrientations) {
            if (!this.placedOrientations[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.placedOrientations[crossTileID] = prevOrientations[crossTileID];
            }
        }

        // this.lastPlacementChangeTime is the time of the last commit() that
        // resulted in a placement change -- in other words, the start time of
        // the last symbol fade animation
        assert(!prevPlacement || prevPlacement.lastPlacementChangeTime !== undefined);
        if (placementChanged) {
            this.lastPlacementChangeTime = now;
        } else if (typeof this.lastPlacementChangeTime !== 'number') {
            this.lastPlacementChangeTime = prevPlacement ? prevPlacement.lastPlacementChangeTime : now;
        }
    }

    updateLayerOpacities(styleLayer: StyleLayer, tiles: Array<Tile>) {
        const seenCrossTileIDs = {};
        for (const tile of tiles) {
            const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
            if (symbolBucket && tile.latestFeatureIndex && styleLayer.id === symbolBucket.layerIds[0]) {
                this.updateBucketOpacities(symbolBucket, seenCrossTileIDs, tile.collisionBoxArray);
            }
        }
    }

    updateBucketOpacities(bucket: SymbolBucket, seenCrossTileIDs: { [string | number]: boolean }, collisionBoxArray: ?CollisionBoxArray) {
        if (bucket.hasTextData()) bucket.text.opacityVertexArray.clear();
        if (bucket.hasIconData()) bucket.icon.opacityVertexArray.clear();
        if (bucket.hasIconCollisionBoxData()) bucket.iconCollisionBox.collisionVertexArray.clear();
        if (bucket.hasTextCollisionBoxData()) bucket.textCollisionBox.collisionVertexArray.clear();

        const layout = bucket.layers[0].layout;
        const duplicateOpacityState = new JointOpacityState(null, 0, false, false, true);
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const variablePlacement = layout.get('text-variable-anchor');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        // If allow-overlap is true, we can show symbols before placement runs on them
        // But we have to wait for placement if we potentially depend on a paired icon/text
        // with allow-overlap: false.
        // See https://github.com/mapbox/mapbox-gl-js/issues/7032
        const defaultOpacityState = new JointOpacityState(null, 0,
                textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || layout.get('icon-optional')),
                iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || layout.get('text-optional')),
                true);

        if (!bucket.collisionArrays && collisionBoxArray && ((bucket.hasIconCollisionBoxData() || bucket.hasTextCollisionBoxData()))) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        const addOpacities = (iconOrText, numVertices: number, opacity: number) => {
            for (let i = 0; i < numVertices / 4; i++) {
                iconOrText.opacityVertexArray.emplaceBack(opacity);
            }
        };

        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances.get(s);
            const {
                numHorizontalGlyphVertices,
                numVerticalGlyphVertices,
                crossTileID
            } = symbolInstance;

            const isDuplicate = seenCrossTileIDs[crossTileID];

            let opacityState = this.opacities[crossTileID];
            if (isDuplicate) {
                opacityState = duplicateOpacityState;
            } else if (!opacityState) {
                opacityState = defaultOpacityState;
                // store the state so that future placements use it as a starting point
                this.opacities[crossTileID] = opacityState;
            }

            seenCrossTileIDs[crossTileID] = true;

            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = symbolInstance.numIconVertices > 0;

            const placedOrientation = this.placedOrientations[symbolInstance.crossTileID];
            const horizontalHidden = placedOrientation === WritingMode.vertical;
            const verticalHidden = placedOrientation === WritingMode.horizontal || placedOrientation === WritingMode.horizontalOnly;

            if (hasText) {
                const packedOpacity = packOpacity(opacityState.text);
                // Vertical text fades in/out on collision the same way as corresponding
                // horizontal text. Switch between vertical/horizontal should be instantaneous
                const horizontalOpacity = horizontalHidden ? PACKED_HIDDEN_OPACITY : packedOpacity;
                addOpacities(bucket.text, numHorizontalGlyphVertices, horizontalOpacity);
                const verticalOpacity = verticalHidden ? PACKED_HIDDEN_OPACITY : packedOpacity;
                addOpacities(bucket.text, numVerticalGlyphVertices, verticalOpacity);

                // If this label is completely faded, mark it so that we don't have to calculate
                // its position at render time. If this layer has variable placement, shift the various
                // symbol instances appropriately so that symbols from buckets that have yet to be placed
                // offset appropriately.
                const symbolHidden = opacityState.text.isHidden();
                [
                    symbolInstance.rightJustifiedTextSymbolIndex,
                    symbolInstance.centerJustifiedTextSymbolIndex,
                    symbolInstance.leftJustifiedTextSymbolIndex
                ].forEach(index => {
                    if (index >= 0) {
                        bucket.text.placedSymbolArray.get(index).hidden = symbolHidden || horizontalHidden ? 1 : 0;
                    }
                });

                if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
                    bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).hidden = symbolHidden || verticalHidden ? 1 : 0;
                }

                const prevOffset = this.variableOffsets[symbolInstance.crossTileID];
                if (prevOffset) {
                    this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, placedOrientation);
                }

                const prevOrientation = this.placedOrientations[symbolInstance.crossTileID];
                if (prevOrientation) {
                    this.markUsedJustification(bucket, 'left', symbolInstance, prevOrientation);
                    this.markUsedOrientation(bucket, prevOrientation, symbolInstance);
                }
            }

            if (hasIcon) {
                const packedOpacity = packOpacity(opacityState.icon);

                if (symbolInstance.placedIconSymbolIndex >= 0) {
                    const horizontalOpacity = !horizontalHidden ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, symbolInstance.numIconVertices, horizontalOpacity);
                    bucket.icon.placedSymbolArray.get(symbolInstance.placedIconSymbolIndex).hidden =
                        (opacityState.icon.isHidden(): any);
                }

                if (symbolInstance.verticalPlacedIconSymbolIndex >= 0) {
                    const verticalOpacity = !verticalHidden ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, symbolInstance.numVerticalIconVertices, verticalOpacity);
                    bucket.icon.placedSymbolArray.get(symbolInstance.verticalPlacedIconSymbolIndex).hidden =
                        (opacityState.icon.isHidden(): any);
                }
            }

            if (bucket.hasIconCollisionBoxData() || bucket.hasTextCollisionBoxData()) {
                const collisionArrays = bucket.collisionArrays[s];
                if (collisionArrays) {
                    let shift = new Point(0, 0);
                    if (collisionArrays.textBox || collisionArrays.verticalTextBox) {
                        let used = true;
                        if (variablePlacement) {
                            const variableOffset = this.variableOffsets[crossTileID];
                            if (variableOffset) {
                                // This will show either the currently placed position or the last
                                // successfully placed position (so you can visualize what collision
                                // just made the symbol disappear, and the most likely place for the
                                // symbol to come back)
                                shift = calculateVariableLayoutShift(variableOffset.anchor,
                                   variableOffset.width,
                                   variableOffset.height,
                                   variableOffset.textOffset,
                                   variableOffset.textScale);
                                if (rotateWithMap) {
                                    shift._rotate(pitchWithMap ? this.transform.angle : -this.transform.angle);
                                }
                            } else {
                                // No offset -> this symbol hasn't been placed since coming on-screen
                                // No single box is particularly meaningful and all of them would be too noisy
                                // Use the center box just to show something's there, but mark it "not used"
                                used = false;
                            }
                        }

                        if (collisionArrays.textBox) {
                            updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used || horizontalHidden, shift.x, shift.y);
                        }
                        if (collisionArrays.verticalTextBox) {
                            updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used || verticalHidden, shift.x, shift.y);
                        }
                    }

                    const verticalIconUsed = Boolean(!verticalHidden && collisionArrays.verticalIconBox);

                    if (collisionArrays.iconBox) {
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, verticalIconUsed,
                            hasIconTextFit ? shift.x : 0,
                            hasIconTextFit ? shift.y : 0);
                    }

                    if (collisionArrays.verticalIconBox) {
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, !verticalIconUsed,
                            hasIconTextFit ? shift.x : 0,
                            hasIconTextFit ? shift.y : 0);
                    }
                }
            }
        }

        bucket.sortFeatures(this.transform.angle);
        if (this.retainedQueryData[bucket.bucketInstanceId]) {
            this.retainedQueryData[bucket.bucketInstanceId].featureSortOrder = bucket.featureSortOrder;
        }

        if (bucket.hasTextData() && bucket.text.opacityVertexBuffer) {
            bucket.text.opacityVertexBuffer.updateData(bucket.text.opacityVertexArray);
        }
        if (bucket.hasIconData() && bucket.icon.opacityVertexBuffer) {
            bucket.icon.opacityVertexBuffer.updateData(bucket.icon.opacityVertexArray);
        }
        if (bucket.hasIconCollisionBoxData() && bucket.iconCollisionBox.collisionVertexBuffer) {
            bucket.iconCollisionBox.collisionVertexBuffer.updateData(bucket.iconCollisionBox.collisionVertexArray);
        }
        if (bucket.hasTextCollisionBoxData() && bucket.textCollisionBox.collisionVertexBuffer) {
            bucket.textCollisionBox.collisionVertexBuffer.updateData(bucket.textCollisionBox.collisionVertexArray);
        }

        assert(bucket.text.opacityVertexArray.length === bucket.text.layoutVertexArray.length / 4);
        assert(bucket.icon.opacityVertexArray.length === bucket.icon.layoutVertexArray.length / 4);

        // Push generated collision circles to the bucket for debug rendering
        if (bucket.bucketInstanceId in this.collisionCircleArrays) {
            const instance = this.collisionCircleArrays[bucket.bucketInstanceId];

            bucket.placementInvProjMatrix = instance.invProjMatrix;
            bucket.placementViewportMatrix = instance.viewportMatrix;
            bucket.collisionCircleArray = instance.circles;

            delete this.collisionCircleArrays[bucket.bucketInstanceId];
        }
    }

    symbolFadeChange(now: number) {
        return this.fadeDuration === 0 ?
            1 :
            ((now - this.commitTime) / this.fadeDuration + this.prevZoomAdjustment);
    }

    zoomAdjustment(zoom: number) {
        // When zooming out quickly, labels can overlap each other. This
        // adjustment is used to reduce the interval between placement calculations
        // and to reduce the fade duration when zooming out quickly. Discovering the
        // collisions more quickly and fading them more quickly reduces the unwanted effect.
        return Math.max(0, (this.transform.zoom - zoom) / 1.5);
    }

    hasTransitions(now: number) {
        return this.stale ||
            now - this.lastPlacementChangeTime < this.fadeDuration;
    }

    stillRecent(now: number, zoom: number) {
        // The adjustment makes placement more frequent when zooming.
        // This condition applies the adjustment only after the map has
        // stopped zooming. This avoids adding extra jank while zooming.
        const durationAdjustment = this.zoomAtLastRecencyCheck === zoom ?
            (1 - this.zoomAdjustment(zoom)) :
            1;
        this.zoomAtLastRecencyCheck = zoom;

        return this.commitTime + this.fadeDuration * durationAdjustment > now;
    }

    setStale() {
        this.stale = true;
    }
}

function updateCollisionVertices(collisionVertexArray: CollisionVertexArray, placed: boolean, notUsed: boolean | number, shiftX?: number, shiftY?: number) {
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
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

const PACKED_HIDDEN_OPACITY = 0;
