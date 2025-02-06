import CollisionIndex from './collision_index';
import EXTENT from '../style-spec/data/extent';
import ONE_EM from './one_em';
import * as symbolSize from './symbol_size';
import * as projection from './projection';
import {getAnchorJustification, evaluateVariableOffset} from './symbol_layout';
import {getAnchorAlignment, WritingMode} from './shaping';
import {mat4} from 'gl-matrix';
import assert from 'assert';
import Point from '@mapbox/point-geometry';
import {getSymbolPlacementTileProjectionMatrix} from '../geo/projection/projection_util';
import {clamp, warnOnce} from '../util/util';
import {transformPointToTile, pointInFootprint, skipClipping} from '../../3d-style/source/replacement_source';
import {LayerTypeMask} from '../../3d-style/util/conflation';

import type BuildingIndex from '../source/building_index';
import type {ReplacementSource} from "../../3d-style/source/replacement_source";
import type Transform from '../geo/transform';
import type StyleLayer from '../style/style_layer';
import type Tile from '../source/tile';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {SymbolBuffers, CollisionArrays, SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {CollisionBoxArray, CollisionVertexArray, SymbolInstance} from '../data/array_types';
import type FeatureIndex from '../data/feature_index';
import type {OverscaledTileID} from '../source/tile_id';
import type {TextAnchor} from './symbol_layout';
import type {FogState} from '../style/fog_helpers';
import type {PlacedCollisionBox} from './collision_index';

// PlacedCollisionBox with all fields optional
type PartialPlacedCollisionBox = Partial<PlacedCollisionBox>;

class OpacityState {
    opacity: number;
    placed: boolean;
    constructor(prevState: OpacityState | null | undefined, increment: number, placed: boolean, skipFade?: boolean | null) {
        if (prevState) {
            this.opacity = Math.max(0, Math.min(1, prevState.opacity + (prevState.placed ? increment : -increment)));
        } else {
            this.opacity = (skipFade && placed) ? 1 : 0;
        }
        this.placed = placed;
    }
    isHidden(): boolean {
        return this.opacity === 0 && !this.placed;
    }
}

class JointOpacityState {
    text: OpacityState;
    icon: OpacityState;
    clipped: boolean;
    constructor(prevState: JointOpacityState | null | undefined, increment: number, placedText: boolean, placedIcon: boolean, skipFade?: boolean | null, clipped: boolean = false) {
        this.text = new OpacityState(prevState ? prevState.text : null, increment, placedText, skipFade);
        this.icon = new OpacityState(prevState ? prevState.icon : null, increment, placedIcon, skipFade);

        this.clipped = clipped;
    }
    isHidden(): boolean {
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

    clipped: boolean;
    constructor(text: boolean, icon: boolean, skipFade: boolean, clipped: boolean = false) {
        this.text = text;
        this.icon = icon;
        this.skipFade = skipFade;
        this.clipped = clipped;
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
    featureSortOrder: Array<number> | null | undefined;
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

export type CollisionGroup = {
    ID: number;
    predicate?: (key: {collisionGroupID: number}) => boolean;
};

class CollisionGroups {
    collisionGroups: {
        [groupName: string]: CollisionGroup;
    };
    maxGroupID: number;
    crossSourceCollisions: boolean;

    constructor(crossSourceCollisions: boolean) {
        this.crossSourceCollisions = crossSourceCollisions;
        this.maxGroupID = 0;
        this.collisionGroups = {};
    }

    get(sourceID: string): CollisionGroup {
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

function calculateVariableLayoutShift(
    anchor: TextAnchor,
    width: number,
    height: number,
    textOffset: [number, number],
    textScale: number,
): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const offset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        shiftX + offset[0] * textScale,
        shiftY + offset[1] * textScale
    );
}

function offsetShift(
    shiftX: number,
    shiftY: number,
    rotateWithMap: boolean,
    pitchWithMap: boolean,
    angle: number,
): Point {
    const shift = new Point(shiftX, shiftY);
    if (rotateWithMap) {
        shift._rotate(pitchWithMap ? angle : -angle);
    }
    return shift;
}

export type VariableOffset = {
    textOffset: [number, number];
    width: number;
    height: number;
    anchor: TextAnchor;
    textScale: number;
    prevAnchor?: TextAnchor;
};

type TileLayerParameters = {
    bucket: SymbolBucket;
    layout: any;
    paint: any;
    posMatrix: mat4;
    textLabelPlaneMatrix: mat4;
    labelToScreenMatrix: mat4 | null | undefined;
    scale: number;
    textPixelRatio: number;
    holdingForFade: boolean;
    collisionBoxArray: CollisionBoxArray | null | undefined;
    partiallyEvaluatedTextSize: any;
    collisionGroup: any;
    latestFeatureIndex: any;
};

export type BucketPart = {
    sortKey?: number | undefined;
    symbolInstanceStart: number;
    symbolInstanceEnd: number;
    parameters: TileLayerParameters;
};

export type CrossTileID = string | number;

export class Placement {
    projection: string;
    transform: Transform;
    collisionIndex: CollisionIndex;
    placements: Partial<Record<CrossTileID, JointPlacement>>;
    opacities: Partial<Record<CrossTileID, JointOpacityState>>;
    variableOffsets: Partial<Record<CrossTileID, VariableOffset>>;
    placedOrientations: Partial<Record<CrossTileID, number>>;
    commitTime: number;
    prevZoomAdjustment: number;
    lastPlacementChangeTime: number;
    stale: boolean;
    fadeDuration: number;
    retainedQueryData: {
        [_: number]: RetainedQueryData;
    };
    collisionGroups: CollisionGroups;
    prevPlacement: Placement | null | undefined;
    zoomAtLastRecencyCheck: number;
    collisionCircleArrays: Partial<Record<any, CollisionCircleArray>>;
    buildingIndex: BuildingIndex | null | undefined;

    constructor(transform: Transform, fadeDuration: number, crossSourceCollisions: boolean, prevPlacement?: Placement, fogState?: FogState | null, buildingIndex?: BuildingIndex | null) {
        this.transform = transform.clone();
        this.projection = transform.projection.name;
        this.collisionIndex = new CollisionIndex(this.transform, fogState);
        this.buildingIndex = buildingIndex;
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

    getBucketParts(results: Array<BucketPart>, styleLayer: StyleLayer, tile: Tile, sortAcrossTiles: boolean, scaleFactor: number = 1) {
        const symbolBucket = (tile.getBucket(styleLayer) as SymbolBucket);
        const bucketFeatureIndex = tile.latestFeatureIndex;

        if (!symbolBucket || !bucketFeatureIndex || styleLayer.fqid !== symbolBucket.layerIds[0])
            return;

        const layout = symbolBucket.layers[0].layout;
        const paint = symbolBucket.layers[0].paint;

        const collisionBoxArray = tile.collisionBoxArray;
        const scale = Math.pow(2, this.transform.zoom - tile.tileID.overscaledZ);
        const textPixelRatio = tile.tileSize / EXTENT;
        const unwrappedTileID = tile.tileID.toUnwrapped();

        this.transform.setProjection(symbolBucket.projection);

        const posMatrix = getSymbolPlacementTileProjectionMatrix(tile.tileID, symbolBucket.getProjection(), this.transform, this.projection);

        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';

        styleLayer.compileFilter(styleLayer.options);

        const dynamicFilter = styleLayer.dynamicFilter();
        const dynamicFilterNeedsFeature = styleLayer.dynamicFilterNeedsFeature();
        const pixelsToTiles = this.transform.calculatePixelsToTileUnitsMatrix(tile);

        const textLabelPlaneMatrix = projection.getLabelPlaneMatrixForPlacement(posMatrix,
                tile.tileID.canonical,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                symbolBucket.getProjection(),
                pixelsToTiles);

        let labelToScreenMatrix = null;

        if (pitchWithMap) {
            const glMatrix = projection.getGlCoordMatrix(
                posMatrix,
                tile.tileID.canonical,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                symbolBucket.getProjection(),
                pixelsToTiles);

            labelToScreenMatrix = mat4.multiply([] as any, this.transform.labelPlaneMatrix, glMatrix);
        }

        let clippingData = null;
        assert(!!tile.latestFeatureIndex);
        if (!!dynamicFilter && tile.latestFeatureIndex) {

            clippingData = {
                unwrappedTileID,
                dynamicFilter,
                dynamicFilterNeedsFeature
            };
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

        const [textSizeScaleRangeMin, textSizeScaleRangeMax] = symbolBucket.layers[0].layout.get('text-size-scale-range');
        const textScaleFactor = clamp(scaleFactor, textSizeScaleRangeMin, textSizeScaleRangeMax);
        const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = layout.get('icon-size-scale-range');
        const iconScaleFactor = clamp(scaleFactor, iconSizeScaleRangeMin, iconSizeScaleRangeMax);

        const parameters = {
            bucket: symbolBucket,
            layout,
            paint,
            posMatrix,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            clippingData,
            scale,
            textPixelRatio,
            holdingForFade: tile.holdingForFade(),
            collisionBoxArray,
            partiallyEvaluatedTextSize: symbolSize.evaluateSizeForZoom(symbolBucket.textSizeData, this.transform.zoom, textScaleFactor),
            partiallyEvaluatedIconSize: symbolSize.evaluateSizeForZoom(symbolBucket.iconSizeData, this.transform.zoom, iconScaleFactor),
            collisionGroup: this.collisionGroups.get(symbolBucket.sourceID),
            latestFeatureIndex: tile.latestFeatureIndex
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

    attemptAnchorPlacement(
        anchor: TextAnchor,
        textBox: SingleCollisionBox,
        width: number,
        height: number,
        textScale: number,
        rotateWithMap: boolean,
        pitchWithMap: boolean,
        textPixelRatio: number,
        posMatrix: mat4,
        collisionGroup: CollisionGroup,
        textAllowOverlap: boolean,
        symbolInstance: SymbolInstance,
        boxIndex: number,
        bucket: SymbolBucket,
        orientation: number,
        iconBox: SingleCollisionBox | null | undefined,
        textSize: any,
        iconSize: any,
    ): {
        shift: Point;
        placedGlyphBoxes: PlacedCollisionBox;
    } | null | undefined {

        const {textOffset0, textOffset1, crossTileID} = symbolInstance;
        const textOffset = [textOffset0, textOffset1];
        // @ts-expect-error - TS2345 - Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
        const shift = calculateVariableLayoutShift(anchor, width, height, textOffset, textScale);

        const placedGlyphBoxes = this.collisionIndex.placeCollisionBox(
            bucket, textScale, textBox, offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle),
            textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
        if (iconBox) {
            const size = bucket.getSymbolInstanceIconSize(iconSize, this.transform.zoom, symbolInstance.placedIconSymbolIndex);
            const placedIconBoxes = this.collisionIndex.placeCollisionBox(
                bucket, size,
                iconBox, offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle),
                textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
            if (placedIconBoxes.box.length === 0) return;
        }

        if (placedGlyphBoxes.box.length > 0) {
            let prevAnchor;
            // If this label was placed in the previous placement, record the anchor position
            // to allow us to animate the transition
            if (this.prevPlacement &&
                this.prevPlacement.variableOffsets[crossTileID] &&
                this.prevPlacement.placements[crossTileID] &&
                this.prevPlacement.placements[crossTileID].text) {
                prevAnchor = this.prevPlacement.variableOffsets[crossTileID].anchor;
            }
            assert(crossTileID !== 0);
            this.variableOffsets[crossTileID] = {
                // @ts-expect-error - TS2322 - Type 'number[]' is not assignable to type '[number, number]'.
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
                this.placedOrientations[crossTileID] = orientation;
            }

            return {shift, placedGlyphBoxes};
        }
    }

    placeLayerBucketPart(bucketPart: any, seenCrossTileIDs: Set<number>, showCollisionBoxes: boolean, updateCollisionBoxIfNecessary: boolean, scaleFactor: number = 1) {

        const {
            bucket,
            layout,
            paint,
            posMatrix,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            clippingData,
            textPixelRatio,
            holdingForFade,
            collisionBoxArray,
            partiallyEvaluatedTextSize,
            partiallyEvaluatedIconSize,
            collisionGroup,
            latestFeatureIndex
        } = bucketPart.parameters;

        const textOptional = layout.get('text-optional');
        const iconOptional = layout.get('icon-optional');
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const zOffset = layout.get('symbol-z-elevate');
        const symbolZOffset = paint.get('symbol-z-offset');
        const elevationFromSea = layout.get('symbol-elevation-reference') === 'sea';
        const [textSizeScaleRangeMin, textSizeScaleRangeMax] = layout.get('text-size-scale-range');
        const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = layout.get('icon-size-scale-range');
        const textScaleFactor = clamp(scaleFactor, textSizeScaleRangeMin, textSizeScaleRangeMax);
        const iconScaleFactor = clamp(scaleFactor, iconSizeScaleRangeMin, iconSizeScaleRangeMax);

        this.transform.setProjection(bucket.projection);

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
        let alwaysShowText = textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || iconOptional);
        let alwaysShowIcon = iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || textOptional);

        const needsFeatureForElevation = !symbolZOffset.isConstant();

        if (!bucket.collisionArrays && collisionBoxArray) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        if (showCollisionBoxes && updateCollisionBoxIfNecessary) {
            bucket.updateCollisionDebugBuffers(this.transform.zoom, collisionBoxArray, textScaleFactor, iconScaleFactor);
        }

        const placeSymbol = (symbolInstance: SymbolInstance, boxIndex: number, collisionArrays: CollisionArrays) => {
            const {crossTileID, numVerticalGlyphVertices} = symbolInstance;

            // Deserialize feature only if necessary
            let feature = null;
            if ((clippingData && clippingData.dynamicFilterNeedsFeature) || needsFeatureForElevation) {
                const retainedQueryData = this.retainedQueryData[bucket.bucketInstanceId];
                feature = latestFeatureIndex.loadFeature({
                    featureIndex: symbolInstance.featureIndex,
                    bucketIndex: retainedQueryData.bucketIndex,
                    sourceLayerIndex: retainedQueryData.sourceLayerIndex,
                    layoutVertexArrayOffset: 0
                });
            }

            if (clippingData) {
                // Setup globals
                const globals = {
                    zoom: this.transform.zoom,
                    pitch: this.transform.pitch,
                };

                const canonicalTileId = this.retainedQueryData[bucket.bucketInstanceId].tileID.canonical;
                const filterFunc = clippingData.dynamicFilter;
                const shouldClip = !filterFunc(globals, feature, canonicalTileId, new Point(symbolInstance.tileAnchorX, symbolInstance.tileAnchorY), this.transform.calculateDistanceTileData(clippingData.unwrappedTileID));

                if (shouldClip) {
                    this.placements[crossTileID] = new JointPlacement(false, false, false, true);
                    seenCrossTileIDs.add(crossTileID);
                    return;
                }
            }

            const symbolZOffsetValue = symbolZOffset.evaluate(feature, {});

            if (seenCrossTileIDs.has(crossTileID)) return;
            if (holdingForFade) {
                // Mark all symbols from this tile as "not placed", but don't add to seenCrossTileIDs, because we don't
                // know yet if we have a duplicate in a parent tile that _should_ be placed.
                this.placements[crossTileID] = new JointPlacement(false, false, false);
                return;
            }
            let placeText: boolean | null | undefined = false;
            let placeIcon: boolean | null | undefined = false;
            let offscreen: boolean | null | undefined = true;
            let textOccluded: boolean | null | undefined = false;
            let iconOccluded = false;
            let shift = null;

            let placed: PartialPlacedCollisionBox = {box: null, offscreen: null, occluded: null};
            let placedVerticalText: PartialPlacedCollisionBox = {box: null, offscreen: null, occluded: null};

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
                const elevation = this.transform.elevation;
                box.elevation = (elevationFromSea ? symbolZOffsetValue : symbolZOffsetValue + (elevation ? elevation.getAtTileOffset(box.tileID, box.tileAnchorX, box.tileAnchorY) : 0));
                box.elevation += symbolInstance.zOffset;
            };

            const textBox = collisionArrays.textBox;
            if (textBox) {
                updateBoxData(textBox);
                const updatePreviousOrientationIfNotPlaced = (isPlaced: boolean) => {
                    let previousOrientation = WritingMode.horizontal;
                    if (bucket.allowVerticalPlacement && !isPlaced && this.prevPlacement) {
                        const prevPlacedOrientation = this.prevPlacement.placedOrientations[crossTileID];
                        if (prevPlacedOrientation) {
                            this.placedOrientations[crossTileID] = prevPlacedOrientation;
                            previousOrientation = prevPlacedOrientation;
                            this.markUsedOrientation(bucket, previousOrientation, symbolInstance);
                        }
                    }
                    return previousOrientation;
                };

                const placeTextForPlacementModes = (placeHorizontalFn: () => PartialPlacedCollisionBox, placeVerticalFn: () => PartialPlacedCollisionBox) => {
                    if (bucket.allowVerticalPlacement && numVerticalGlyphVertices > 0 && collisionArrays.verticalTextBox) {
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
                    const placeBox = (collisionTextBox: SingleCollisionBox, orientation: number) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, this.transform.zoom, boxIndex, scaleFactor);
                        const placedFeature = this.collisionIndex.placeCollisionBox(bucket, textScale, collisionTextBox,
                            new Point(0, 0), textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
                        if (placedFeature && placedFeature.box && placedFeature.box.length) {
                            this.markUsedOrientation(bucket, orientation, symbolInstance);
                            this.placedOrientations[crossTileID] = orientation;
                        }
                        return placedFeature;
                    };

                    const placeHorizontal: () => PlacedCollisionBox = () => {
                        return placeBox(textBox, WritingMode.horizontal);
                    };

                    const placeVertical: () => PlacedCollisionBox | PartialPlacedCollisionBox = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (bucket.allowVerticalPlacement && numVerticalGlyphVertices > 0 && verticalTextBox) {
                            updateBoxData(verticalTextBox);
                            return placeBox(verticalTextBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null, occluded: null};
                    };

                    placeTextForPlacementModes(
                        (placeHorizontal as () => PartialPlacedCollisionBox),
                        (placeVertical as () => PartialPlacedCollisionBox),
                    );

                    const isPlaced = placed && placed.box && placed.box.length;
                    updatePreviousOrientationIfNotPlaced(!!isPlaced);

                } else {
                    let anchors = layout.get('text-variable-anchor');

                    // If this symbol was in the last placement, shift the previously used
                    // anchor to the front of the anchor list, only if the previous anchor
                    // is still in the anchor list
                    if (this.prevPlacement && this.prevPlacement.variableOffsets[crossTileID]) {
                        const prevOffsets = this.prevPlacement.variableOffsets[crossTileID];
                        if (anchors.indexOf(prevOffsets.anchor) > 0) {
                            anchors = anchors.filter(anchor => anchor !== prevOffsets.anchor);
                            anchors.unshift(prevOffsets.anchor);
                        }
                    }

                    const placeBoxForVariableAnchors = (collisionTextBox: SingleCollisionBox, collisionIconBox: SingleCollisionBox | null | undefined, orientation: number) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, this.transform.zoom, boxIndex);
                        const width = (collisionTextBox.x2 - collisionTextBox.x1) * textScale + 2.0 * collisionTextBox.padding;
                        const height = (collisionTextBox.y2 - collisionTextBox.y1) * textScale + 2.0 * collisionTextBox.padding;

                        const variableIconBox = symbolInstance.hasIconTextFit && !iconAllowOverlap ? collisionIconBox : null;
                        if (variableIconBox) updateBoxData(variableIconBox);

                        let placedBox: PartialPlacedCollisionBox = {box: [], offscreen: false, occluded: false};
                        const placementAttempts = textAllowOverlap ? anchors.length * 2 : anchors.length;
                        for (let i = 0; i < placementAttempts; ++i) {
                            const anchor = anchors[i % anchors.length];
                            const allowOverlap = (i >= anchors.length);
                            const result = this.attemptAnchorPlacement(
                                anchor, collisionTextBox, width, height, textScale, rotateWithMap,
                                pitchWithMap, textPixelRatio, posMatrix, collisionGroup, allowOverlap,
                                symbolInstance, boxIndex, bucket, orientation, variableIconBox,
                                partiallyEvaluatedTextSize, partiallyEvaluatedIconSize);

                            if (result) {
                                placedBox = (result.placedGlyphBoxes as PartialPlacedCollisionBox);
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
                        if (bucket.allowVerticalPlacement && !wasPlaced && numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBoxForVariableAnchors(verticalTextBox, collisionArrays.verticalIconBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null, occluded: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);

                    if (placed) {
                        // @ts-expect-error - placeText is boolean, box is number[]
                        placeText = placed.box;
                        offscreen = placed.offscreen;
                        textOccluded = placed.occluded;
                    }

                    const isPlaced = placed && placed.box;
                    const prevOrientation = updatePreviousOrientationIfNotPlaced(!!isPlaced);

                    // If we didn't get placed, we still need to copy our position from the last placement for
                    // fade animations
                    if (!placeText && this.prevPlacement) {
                        const prevOffset = this.prevPlacement.variableOffsets[crossTileID];
                        if (prevOffset) {
                            this.variableOffsets[crossTileID] = prevOffset;
                            this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, prevOrientation);
                        }
                    }

                }
            }

            placedGlyphBoxes = placed;

            placeText = placedGlyphBoxes && placedGlyphBoxes.box && placedGlyphBoxes.box.length > 0;
            offscreen = placedGlyphBoxes && placedGlyphBoxes.offscreen;
            textOccluded = placedGlyphBoxes && placedGlyphBoxes.occluded;

            if (symbolInstance.useRuntimeCollisionCircles) {
                const placedSymbolIndex = symbolInstance.centerJustifiedTextSymbolIndex >= 0 ? symbolInstance.centerJustifiedTextSymbolIndex : symbolInstance.verticalPlacedTextSymbolIndex;
                const placedSymbol = bucket.text.placedSymbolArray.get(placedSymbolIndex);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);

                const textPixelPadding = layout.get('text-padding');
                // Convert circle collision height into pixels
                const circlePixelDiameter = symbolInstance.collisionCircleDiameter * fontSize / ONE_EM;

                placedGlyphCircles = this.collisionIndex.placeCollisionCircles(
                        bucket,
                        textAllowOverlap,
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
                textOccluded = placedGlyphCircles.occluded;
            }

            if (collisionArrays.iconFeatureIndex) {
                iconFeatureIndex = collisionArrays.iconFeatureIndex;
            }

            if (collisionArrays.iconBox) {

                const placeIconFeature = (iconBox: SingleCollisionBox) => {
                    updateBoxData(iconBox);
                    const shiftPoint: Point = symbolInstance.hasIconTextFit && shift ?
                        offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, this.transform.angle) :
                        new Point(0, 0);
                    const iconScale = bucket.getSymbolInstanceIconSize(partiallyEvaluatedIconSize, this.transform.zoom, symbolInstance.placedIconSymbolIndex);
                    return this.collisionIndex.placeCollisionBox(bucket, iconScale, iconBox, shiftPoint,
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
                iconOccluded = placedIconBoxes.occluded;
            }

            const iconWithoutText = textOptional ||
                (symbolInstance.numHorizontalGlyphVertices === 0 && numVerticalGlyphVertices === 0);
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

            assert(crossTileID !== 0);
            assert(bucket.bucketInstanceId !== 0);

            const notGlobe = bucket.projection.name !== 'globe';
            alwaysShowText = alwaysShowText && (notGlobe || !textOccluded);
            alwaysShowIcon = alwaysShowIcon && (notGlobe || !iconOccluded);

            this.placements[crossTileID] = new JointPlacement(placeText || alwaysShowText, placeIcon || alwaysShowIcon, offscreen || bucket.justReloaded);
            seenCrossTileIDs.add(crossTileID);
        };

        if (zOffset && this.buildingIndex) {
            const tileID = this.retainedQueryData[bucket.bucketInstanceId].tileID;
            this.buildingIndex.updateZOffset(bucket, tileID);
            bucket.updateZOffset();
        }

        if (bucket.sortFeaturesByY) {
            assert(bucketPart.symbolInstanceStart === 0);
            const symbolIndexes = bucket.getSortedSymbolIndexes(this.transform.angle);
            for (let i = symbolIndexes.length - 1; i >= 0; --i) {
                const symbolIndex = symbolIndexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), symbolIndex, bucket.collisionArrays[symbolIndex]);
            }
            if (bucket.hasAnyZOffset) warnOnce(`${bucket.layerIds[0]} layer symbol-z-elevate: symbols are not sorted by elevation if symbol-z-order is evaluated to viewport-y`);
        } else if (bucket.hasAnyZOffset) {
            const indexes = bucket.getSortedIndexesByZOffset();
            for (let i = 0; i < indexes.length; ++i) {
                const symbolIndex = indexes[i];
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
        const {
            leftJustifiedTextSymbolIndex: left, centerJustifiedTextSymbolIndex: center,
            rightJustifiedTextSymbolIndex: right, verticalPlacedTextSymbolIndex: vertical, crossTileID
        } = symbolInstance;

        const justification = getAnchorJustification(placedAnchor);
        const autoIndex =
            orientation === WritingMode.vertical ? vertical :
            justification === 'left' ? left :
            justification === 'center' ? center :
            justification === 'right' ? right : -1;

        // If there are multiple justifications and this one isn't it: shift offscreen
        // If either this is the chosen justification or the justification is hardwired: use it
        if (left >= 0) bucket.text.placedSymbolArray.get(left).crossTileID = autoIndex >= 0 && left !== autoIndex ? 0 : crossTileID;
        if (center >= 0) bucket.text.placedSymbolArray.get(center).crossTileID = autoIndex >= 0 && center !== autoIndex ? 0 : crossTileID;
        if (right >= 0) bucket.text.placedSymbolArray.get(right).crossTileID = autoIndex >= 0 && right !== autoIndex ? 0 : crossTileID;
        if (vertical >= 0) bucket.text.placedSymbolArray.get(vertical).crossTileID = autoIndex >= 0 && vertical !== autoIndex ? 0 : crossTileID;
    }

    markUsedOrientation(bucket: SymbolBucket, orientation: number, symbolInstance: SymbolInstance) {
        const horizontalOrientation = (orientation === WritingMode.horizontal || orientation === WritingMode.horizontalOnly) ? orientation : 0;
        const verticalOrientation = orientation === WritingMode.vertical ? orientation : 0;
        const {
            leftJustifiedTextSymbolIndex: left, centerJustifiedTextSymbolIndex: center,
            rightJustifiedTextSymbolIndex: right, verticalPlacedTextSymbolIndex: vertical
        } = symbolInstance;
        const array = bucket.text.placedSymbolArray;

        if (left >= 0) array.get(left).placedOrientation = horizontalOrientation;
        if (center >= 0) array.get(center).placedOrientation = horizontalOrientation;
        if (right >= 0) array.get(right).placedOrientation = horizontalOrientation;
        if (vertical >= 0) array.get(vertical).placedOrientation = verticalOrientation;
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
                this.opacities[crossTileID] = new JointOpacityState(prevOpacity, increment, jointPlacement.text, jointPlacement.icon, null, jointPlacement.clipped);
                placementChanged = placementChanged ||
                    jointPlacement.text !== prevOpacity.text.placed ||
                    jointPlacement.icon !== prevOpacity.icon.placed;
            } else {
                this.opacities[crossTileID] = new JointOpacityState(null, increment, jointPlacement.text, jointPlacement.icon, jointPlacement.skipFade, jointPlacement.clipped);
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

    updateLayerOpacities(styleLayer: StyleLayer, tiles: Array<Tile>, layerIndex: number, replacementSource?: ReplacementSource | null) {
        const seenCrossTileIDs = new Set();
        for (const tile of tiles) {
            const symbolBucket = (tile.getBucket(styleLayer) as SymbolBucket);
            if (symbolBucket && tile.latestFeatureIndex && styleLayer.fqid === symbolBucket.layerIds[0]) {
                // @ts-expect-error - TS2345 - Argument of type 'Set<unknown>' is not assignable to parameter of type 'Set<number>'.
                this.updateBucketOpacities(symbolBucket, seenCrossTileIDs, tile, tile.collisionBoxArray, layerIndex, replacementSource, tile.tileID, styleLayer.scope);
                const layout = symbolBucket.layers[0].layout;
                if (layout.get('symbol-z-elevate') && this.buildingIndex) {
                    this.buildingIndex.updateZOffset(symbolBucket, tile.tileID);
                    symbolBucket.updateZOffset();
                }
            }
        }
    }

    updateBucketOpacities(bucket: SymbolBucket, seenCrossTileIDs: Set<number>, tile: Tile, collisionBoxArray: CollisionBoxArray | null | undefined, layerIndex: number, replacementSource: ReplacementSource | null | undefined, coord: OverscaledTileID, scope: string) {
        if (bucket.hasTextData()) bucket.text.opacityVertexArray.clear();
        if (bucket.hasIconData()) bucket.icon.opacityVertexArray.clear();
        if (bucket.hasIconCollisionBoxData()) bucket.iconCollisionBox.collisionVertexArray.clear();
        if (bucket.hasTextCollisionBoxData()) bucket.textCollisionBox.collisionVertexArray.clear();

        const layout = bucket.layers[0].layout;
        const paint = bucket.layers[0].paint;
        const hasClipping = !!bucket.layers[0].dynamicFilter();
        const duplicateOpacityState = new JointOpacityState(null, 0, false, false, true);
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const variablePlacement = layout.get('text-variable-anchor');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const symbolZOffset = paint.get('symbol-z-offset');
        const elevationFromSea = layout.get('symbol-elevation-reference') === 'sea';
        const needsFeatureForElevation = !symbolZOffset.isConstant();

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

        const addOpacities = (iconOrText: SymbolBuffers, numVertices: number, opacity: number) => {
            for (let i = 0; i < numVertices / 4; i++) {
                iconOrText.opacityVertexArray.emplaceBack(opacity);
            }
        };

        let visibleInstanceCount = 0;

        if (replacementSource) {
            bucket.updateReplacement(coord, replacementSource);
        }

        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances.get(s);
            const {
                numHorizontalGlyphVertices,
                numVerticalGlyphVertices,
                crossTileID,
                numIconVertices,
                tileAnchorX,
                tileAnchorY
            } = symbolInstance;

            let feature = null;
            const retainedQueryData = this.retainedQueryData[bucket.bucketInstanceId];
            if (needsFeatureForElevation && symbolInstance && retainedQueryData) {
                const featureIndex = tile.latestFeatureIndex;
                feature = featureIndex.loadFeature({
                    featureIndex: symbolInstance.featureIndex,
                    bucketIndex: retainedQueryData.bucketIndex,
                    sourceLayerIndex: retainedQueryData.sourceLayerIndex,
                    layoutVertexArrayOffset: 0
                });
            }

            const symbolZOffsetValue = symbolZOffset.evaluate(feature, {});
            const isDuplicate = seenCrossTileIDs.has(crossTileID);

            let opacityState = this.opacities[crossTileID];
            if (isDuplicate) {
                opacityState = duplicateOpacityState;
            } else if (!opacityState) {
                opacityState = defaultOpacityState;
                // store the state so that future placements use it as a starting point
                this.opacities[crossTileID] = opacityState;
            }

            seenCrossTileIDs.add(crossTileID);

            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = numIconVertices > 0;

            const placedOrientation = this.placedOrientations[crossTileID];
            const horizontalHidden = placedOrientation === WritingMode.vertical;
            const verticalHidden = placedOrientation === WritingMode.horizontal || placedOrientation === WritingMode.horizontalOnly;
            if ((hasText || hasIcon) && !opacityState.isHidden()) visibleInstanceCount++;

            let clippedSymbol = false;
            if ((hasText || hasIcon) && replacementSource) {
                for (const region of bucket.activeReplacements) {
                    if (skipClipping(region, layerIndex, LayerTypeMask.Symbol, scope)) continue;

                    if (region.min.x > tileAnchorX || tileAnchorX > region.max.x || region.min.y > tileAnchorY || tileAnchorY > region.max.y) {
                        continue;
                    }

                    const p = transformPointToTile(tileAnchorX, tileAnchorY, coord.canonical, region.footprintTileId.canonical);
                    clippedSymbol = pointInFootprint(p, region.footprint);

                    if (clippedSymbol) break;
                }
            }

            if (hasText) {
                const packedOpacity = clippedSymbol ? PACKED_HIDDEN_OPACITY : packOpacity(opacityState.text);
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
                const {
                    leftJustifiedTextSymbolIndex: left, centerJustifiedTextSymbolIndex: center,
                    rightJustifiedTextSymbolIndex: right, verticalPlacedTextSymbolIndex: vertical
                } = symbolInstance;
                const array = bucket.text.placedSymbolArray;
                const horizontalHiddenValue = symbolHidden || horizontalHidden ? 1 : 0;

                if (left >= 0) array.get(left).hidden = horizontalHiddenValue;
                if (center >= 0) array.get(center).hidden = horizontalHiddenValue;
                if (right >= 0) array.get(right).hidden = horizontalHiddenValue;
                if (vertical >= 0) array.get(vertical).hidden = symbolHidden || verticalHidden ? 1 : 0;

                const prevOffset = this.variableOffsets[crossTileID];
                if (prevOffset) {
                    this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, placedOrientation);
                }

                const prevOrientation = this.placedOrientations[crossTileID];
                if (prevOrientation) {
                    this.markUsedJustification(bucket, 'left', symbolInstance, prevOrientation);
                    this.markUsedOrientation(bucket, prevOrientation, symbolInstance);
                }
            }

            if (hasIcon) {
                const packedOpacity = clippedSymbol ? PACKED_HIDDEN_OPACITY : packOpacity(opacityState.icon);
                const {placedIconSymbolIndex, verticalPlacedIconSymbolIndex} = symbolInstance;
                const array = bucket.icon.placedSymbolArray;
                const iconHidden = opacityState.icon.isHidden() ? 1 : 0;

                if (placedIconSymbolIndex >= 0) {
                    const horizontalOpacity = !horizontalHidden ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, numIconVertices, horizontalOpacity);
                    array.get(placedIconSymbolIndex).hidden = iconHidden;
                }

                if (verticalPlacedIconSymbolIndex >= 0) {
                    const verticalOpacity = !verticalHidden ? packedOpacity : PACKED_HIDDEN_OPACITY;
                    addOpacities(bucket.icon, symbolInstance.numVerticalIconVertices, verticalOpacity);
                    array.get(verticalPlacedIconSymbolIndex).hidden = iconHidden;
                }
            }

            if (bucket.hasIconCollisionBoxData() || bucket.hasTextCollisionBoxData()) {
                const collisionArrays = bucket.collisionArrays[s];
                if (collisionArrays) {
                    let shift = new Point(0, 0);
                    let used = true;
                    if (collisionArrays.textBox || collisionArrays.verticalTextBox) {
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

                        if (hasClipping) {
                            used = !opacityState.clipped;
                        }

                        if (collisionArrays.textBox) {
                            updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used || horizontalHidden, symbolZOffsetValue, elevationFromSea, shift.x, shift.y);
                        }
                        if (collisionArrays.verticalTextBox) {
                            updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used || verticalHidden, symbolZOffsetValue, elevationFromSea, shift.x, shift.y);
                        }
                    }

                    const verticalIconUsed = used && Boolean(!verticalHidden && collisionArrays.verticalIconBox);

                    if (collisionArrays.iconBox) {
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, verticalIconUsed, symbolZOffsetValue, elevationFromSea,
                            symbolInstance.hasIconTextFit ? shift.x : 0,
                            symbolInstance.hasIconTextFit ? shift.y : 0);
                    }

                    if (collisionArrays.verticalIconBox) {
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, !verticalIconUsed, symbolZOffsetValue, elevationFromSea,
                            symbolInstance.hasIconTextFit ? shift.x : 0,
                            symbolInstance.hasIconTextFit ? shift.y : 0);
                    }
                }
            }
        }
        bucket.fullyClipped = visibleInstanceCount === 0;
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

    symbolFadeChange(now: number): number {
        return this.fadeDuration === 0 ?
            1 :
            ((now - this.commitTime) / this.fadeDuration + this.prevZoomAdjustment);
    }

    zoomAdjustment(zoom: number): number {
        // When zooming out quickly, labels can overlap each other. This
        // adjustment is used to reduce the interval between placement calculations
        // and to reduce the fade duration when zooming out quickly. Discovering the
        // collisions more quickly and fading them more quickly reduces the unwanted effect.
        return Math.max(0, (this.transform.zoom - zoom) / 1.5);
    }

    hasTransitions(now: number): boolean {
        return this.stale ||
            now - this.lastPlacementChangeTime < this.fadeDuration;
    }

    stillRecent(now: number, zoom: number): boolean {
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

function updateCollisionVertices(collisionVertexArray: CollisionVertexArray, placed: boolean, notUsed: boolean | number, elevation: number, elevationFromSea: boolean, shiftX?: number, shiftY?: number) {
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, elevation, elevationFromSea ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, elevation, elevationFromSea ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, elevation, elevationFromSea ? 1 : 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0, elevation, elevationFromSea ? 1 : 0);
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
