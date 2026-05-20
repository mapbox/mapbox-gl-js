import Point from '@mapbox/point-geometry';
import assert from '../style-spec/util/assert';
import {mat4} from 'gl-matrix';
import {pointInFootprint, skipClipping, transformPointToTile} from '../../3d-style/source/replacement_source';
import {LayerTypeMask} from '../../3d-style/util/conflation';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';
import {getSymbolPlacementTileProjectionMatrix} from '../geo/projection/projection_util';
import EXTENT from '../style-spec/data/extent';
import {clamp} from '../util/util';
import * as projection from './projection';
import {getAnchorAlignment, WritingMode} from './shaping';
import {evaluateVariableOffset, getAnchorJustification} from './symbol_layout';
import {evaluateSizeForZoom} from './symbol_size';

import type {ReplacementSource} from '../../3d-style/source/replacement_source';
import type {CollisionBoxArray, CollisionVertexArray, SymbolInstance} from '../data/array_types';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {SymbolBuffers} from '../data/bucket/symbol_bucket';
import type FeatureIndex from '../data/feature_index';
import type Transform from '../geo/transform';
import type BuildingIndex from '../source/building_index';
import type Tile from '../source/tile';
import type {OverscaledTileID, UnwrappedTileID} from '../source/tile_id';
import type {FogState} from '../style/fog_helpers';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {Orientation} from './shaping';
import type {TextAnchor} from './symbol_layout';
import type {Feature} from '../style-spec/expression/index';
import type {InterpolatedSize} from './symbol_size';
import type {FilterExpression} from '../style-spec/feature_filter/index';
import type {PlacementAlgorithm, CollisionDetector} from './placement_algorithm';
import type {PossiblyEvaluated} from '../style/properties';
import type {LayoutProps, PaintProps} from '../style/style_layer/symbol_style_layer_properties';

export class OpacityState {
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

export class JointOpacityState {
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

export class JointPlacement {
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

export class CollisionCircleArray {
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

    constructor(
        bucketInstanceId: number,
        featureIndex: FeatureIndex,
        sourceLayerIndex: number,
        bucketIndex: number,
        tileID: OverscaledTileID
    ) {
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

export function calculateVariableLayoutShift(
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

export function offsetShift(
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

export function markUsedJustification(bucket: SymbolBucket, placedAnchor: TextAnchor, symbolInstance: SymbolInstance, orientation: number) {
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

export function markUsedOrientation(bucket: SymbolBucket, orientation: number, symbolInstance: SymbolInstance) {
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

export type VariableOffset = {
    textOffset: [number, number];
    width: number;
    height: number;
    anchor: TextAnchor;
    textScale: number;
    prevAnchor?: TextAnchor;
};

type ClippingData = {
    unwrappedTileID: UnwrappedTileID;
    dynamicFilter: FilterExpression;
    dynamicFilterNeedsFeature: boolean;
    needGeometry: boolean;
};

type TileLayerParameters = {
    bucket: SymbolBucket;
    layout: PossiblyEvaluated<LayoutProps>;
    paint: PossiblyEvaluated<PaintProps>;
    posMatrix: mat4;
    invMatrix: mat4;
    mercatorCenter: [number, number];
    textLabelPlaneMatrix: mat4;
    labelToScreenMatrix: mat4;
    clippingData: ClippingData;
    scale: number;
    textPixelRatio: number;
    holdingForFade: boolean;
    collisionBoxArray: CollisionBoxArray | null | undefined;
    partiallyEvaluatedTextSize: InterpolatedSize;
    partiallyEvaluatedIconSize: InterpolatedSize;
    collisionGroup: CollisionGroup;
    latestFeatureIndex: FeatureIndex;
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
    collisionIndex: CollisionDetector;
    algorithm: PlacementAlgorithm;
    placements: Partial<Record<CrossTileID, JointPlacement>>;
    opacities: Partial<Record<CrossTileID, JointOpacityState>>;
    variableOffsets: Partial<Record<CrossTileID, VariableOffset>>;
    placedOrientations: Partial<Record<CrossTileID, Orientation>>;
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
    lastReplacementSourceUpdateTime: number;
    zoomAtLastRecencyCheck: number;
    collisionCircleArrays: Partial<Record<number, CollisionCircleArray>>;
    buildingIndex: BuildingIndex | null | undefined;
    frontCutoffStart: number;

    constructor(transform: Transform, fadeDuration: number, crossSourceCollisions: boolean, algorithm: PlacementAlgorithm, prevPlacement?: Placement, fogState?: FogState | null, buildingIndex?: BuildingIndex | null, retiredCollisionDetector?: CollisionDetector | null) {
        this.transform = transform.clone();
        this.projection = transform.projection.name;
        this.algorithm = algorithm;
        this.collisionIndex = this.algorithm.createCollisionDetector(this.transform, fogState, retiredCollisionDetector);
        this.buildingIndex = buildingIndex;
        this.frontCutoffStart = 0;
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
        this.lastReplacementSourceUpdateTime = 0;
    }

    getBucketParts(results: Array<BucketPart>, styleLayer: TypedStyleLayer, tile: Tile, sortAcrossTiles: boolean, scaleFactor: number = 1) {
        const symbolBucket = tile.getBucket(styleLayer) as SymbolBucket;
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
        const dynamicFilterNeedsGeometry = styleLayer.dynamicFilterNeedsGeometry();
        const pixelsToTiles = this.transform.calculatePixelsToTileUnitsMatrix(tile);

        const textLabelPlaneMatrix = projection.getLabelPlaneMatrixForPlacement(posMatrix,
                tile.tileID.canonical,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                symbolBucket.getProjection(),
                pixelsToTiles);

        let labelToScreenMatrix: mat4 = null;
        const invMatrix = symbolBucket.getProjection().createInversionMatrix(this.transform, tile.tileID.canonical);

        if (pitchWithMap) {
            const glMatrix = projection.getGlCoordMatrix(
                posMatrix,
                tile.tileID.canonical,
                pitchWithMap,
                rotateWithMap,
                this.transform,
                symbolBucket.getProjection(),
                pixelsToTiles);

            labelToScreenMatrix = mat4.multiply([], this.transform.labelPlaneMatrix, glMatrix);
        }

        let clippingData: ClippingData = null;
        assert(!!tile.latestFeatureIndex);
        if (!!dynamicFilter && tile.latestFeatureIndex) {

            clippingData = {
                unwrappedTileID,
                dynamicFilter,
                dynamicFilterNeedsFeature,
                needGeometry: dynamicFilterNeedsGeometry
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
        const mercatorCenter: [number, number] = [
            mercatorXfromLng(this.transform.center.lng),
            mercatorYfromLat(this.transform.center.lat)
        ];

        const parameters: TileLayerParameters = {
            bucket: symbolBucket,
            layout,
            paint,
            posMatrix,
            invMatrix,
            mercatorCenter,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            clippingData,
            scale,
            textPixelRatio,
            holdingForFade: tile.holdingForFade(),
            collisionBoxArray,
            partiallyEvaluatedTextSize: evaluateSizeForZoom(symbolBucket.textSizeData, this.transform.zoom, textScaleFactor),
            partiallyEvaluatedIconSize: evaluateSizeForZoom(symbolBucket.iconSizeData, this.transform.zoom, iconScaleFactor),
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

    placeLayerBucketPart(bucketPart: BucketPart, seenCrossTileIDs: Set<number>, showCollisionBoxes: boolean, updateCollisionBoxIfNecessary: boolean, scaleFactor: number = 1) {
        this.algorithm.placeLayerBucketPart(this, bucketPart, seenCrossTileIDs, showCollisionBoxes, updateCollisionBoxIfNecessary, scaleFactor);
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

    updateLayerOpacities(styleLayer: TypedStyleLayer, tiles: Array<Tile>, layerIndex: number, replacementSource?: ReplacementSource | null) {
        if (replacementSource) {
            this.lastReplacementSourceUpdateTime = replacementSource.updateTime;
        }

        const seenCrossTileIDs = new Set<number>();
        for (const tile of tiles) {
            const symbolBucket = tile.getBucket(styleLayer) as SymbolBucket;
            if (symbolBucket && tile.latestFeatureIndex && styleLayer.fqid === symbolBucket.layerIds[0]) {
                this.updateBucketOpacities(symbolBucket, seenCrossTileIDs, tile, tile.collisionBoxArray, layerIndex, replacementSource, tile.tileID, styleLayer.scope);
                if (symbolBucket.elevationType === 'offset' && this.buildingIndex) {
                    this.buildingIndex.updateZOffset(symbolBucket, tile.tileID);
                }
                if (symbolBucket.elevationType === 'road' && symbolBucket.hdExt) {
                    symbolBucket.hdExt.updateRoadElevation(symbolBucket, tile.tileID.canonical);
                }
                symbolBucket.updateZOffset();
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

        // Reset clipped state for this bucket so stale entries from a previous frame are cleared.
        this.collisionIndex.clearClippedSymbolsForBucket(bucket.bucketInstanceId);

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

            let feature: Feature = null;
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

            if (clippedSymbol) {
                this.collisionIndex.markSymbolAsClipped(bucket.bucketInstanceId, symbolInstance.featureIndex);
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
                    markUsedJustification(bucket, prevOffset.anchor, symbolInstance, placedOrientation);
                }

                const prevOrientation = this.placedOrientations[crossTileID];
                if (prevOrientation) {
                    markUsedJustification(bucket, 'left', symbolInstance, prevOrientation);
                    markUsedOrientation(bucket, prevOrientation, symbolInstance);
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
        return now - this.lastPlacementChangeTime < this.fadeDuration;
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

    isStale(): boolean {
        return this.stale;
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
