import assert from '../../../src/style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import {quat, vec3} from 'gl-matrix';
import {register} from '../../../src/util/web_worker_transfer';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';
import {ElevationFeatureSampler} from '../../elevation/elevation_feature';
import {getElevationFeature} from '../../elevation/get_elevation_feature';

import type {CanonicalTileID, OverscaledTileID} from '../../../src/source/tile_id';
import type SymbolBucket from '../../../src/data/bucket/symbol_bucket';
import type {SymbolBuffers} from '../../../src/data/bucket/symbol_bucket';
import type {BucketFeature} from '../../../src/data/bucket';
import type {ElevationFeature} from '../../elevation/elevation_feature';
import type {SymbolOrientationArray} from '../../../src/data/array_types';
import type {ElevationParams as CoverageElevationParams} from '../../../src/source/elevation_coverage_snapshot';
import type {GetElevation, ElevationParams} from '../../../src/symbol/projection';
import type Projection from '../../../src/geo/projection/projection';
import type {Elevation} from '../../../src/terrain/elevation';

function offsetVectorFromFeatureHeight(
    height: number,
    canonical: CanonicalTileID,
    point: Point,
    projection: Projection,
    lat: number,
    worldSize: number,
): [number, number, number] {
    const upVector = projection.upVector(canonical, point.x, point.y);
    const upVectorScale = projection.upVectorScale(canonical, lat, worldSize).metersToTile;
    vec3.scale(upVector, upVector, height * upVectorScale);
    return [upVector[0], upVector[1], upVector[2]];
}

const addOrientationVertex = (orientationArray: SymbolOrientationArray, numVertices: number, orientedXAxis: vec3, orientedYAxis: vec3) => {
    for (let i = 0; i < numVertices; i++) {
        orientationArray.emplaceBack(orientedXAxis[0], orientedXAxis[1], orientedXAxis[2], orientedYAxis[0], orientedYAxis[1], orientedYAxis[2]);
    }
};

/**
 * HD extension for SymbolBucket. Owns the per-tile HD `ElevationFeature` references
 * and the routines that consume them.
 *
 * `elevationType` deliberately stays on the core bucket — its `'offset'` value is set by
 * the non-HD `symbol-z-elevate` branch, so it can't live here. The extension only
 * coordinates the `'road'` path, which is always paired with an attached extension.
 *
 * @private
 */
export class SymbolHDExtension {
    elevationFeatures: Array<ElevationFeature>;
    elevationFeatureTileIds: Array<CanonicalTileID>;
    elevationFeatureIdToIndex: Map<number, number>;
    elevationStateComplete: boolean;
    hasDeferredElevationFeatures: boolean;
    consumerCanonical: CanonicalTileID | undefined;
    elevationParams: CoverageElevationParams | null | undefined;
    crossSourceElevationEnabled: boolean;
    terrainEnabled: boolean;

    constructor() {
        this.elevationFeatures = [];
        this.elevationFeatureTileIds = [];
        this.elevationFeatureIdToIndex = new Map<number, number>();
        this.elevationStateComplete = false;
        this.hasDeferredElevationFeatures = false;
        this.elevationParams = null;
        this.crossSourceElevationEnabled = false;
        this.terrainEnabled = false;
    }

    configureCrossSource(
        consumerCanonical: CanonicalTileID,
        elevationParams: CoverageElevationParams | null | undefined,
        crossSourceElevationEnabled: boolean,
        terrainEnabled: boolean,
    ): void {
        this.consumerCanonical = consumerCanonical;
        this.elevationParams = elevationParams;
        this.crossSourceElevationEnabled = crossSourceElevationEnabled;
        this.terrainEnabled = terrainEnabled;
    }

    addElevationFeatures(features: ElevationFeature[], tileId: CanonicalTileID): void {
        for (const elevationFeature of features) {
            this.elevationFeatureIdToIndex.set(elevationFeature.id, this.elevationFeatures.length);
            this.elevationFeatures.push(elevationFeature);
            this.elevationFeatureTileIds.push(tileId);
        }
    }

    /**
     * Resolve the elevation feature index for a symbol feature. Returns `'defer'` when
     * cross-source providers are still loading; otherwise an index or `0xffff` (flat).
     */
    resolveRoadElevation(feature: {properties?: Record<string, unknown> | null}, elevationFeatureId: number): number | 'defer' {
        assert(this.consumerCanonical);

        const existing = this.elevationFeatureIdToIndex.get(elevationFeatureId);
        if (existing !== undefined) {
            return existing;
        }

        if (this.terrainEnabled || !this.crossSourceElevationEnabled) {
            return 0xffff;
        }

        const tiled = getElevationFeature(
            feature as BucketFeature,
            undefined,
            this.elevationParams ? this.elevationParams.registry : undefined,
            this.consumerCanonical,
        );

        if (tiled) {
            const index = this.elevationFeatures.length;
            this.elevationFeatureIdToIndex.set(elevationFeatureId, index);
            this.elevationFeatures.push(tiled.feature);
            this.elevationFeatureTileIds.push(tiled.tileId);
            return index;
        }

        if (!this.elevationParams || !this.elevationParams.allProvidersReady) {
            this.hasDeferredElevationFeatures = true;
            return 'defer';
        }

        return 0xffff;
    }

    private elevationFeatureSamplerCache: Map<number, ElevationFeatureSampler> | undefined;

    private getElevationFeatureSampler(consumerCanonical: CanonicalTileID, providerTileId: CanonicalTileID): ElevationFeatureSampler {
        if (providerTileId.equals(consumerCanonical)) {
            return new ElevationFeatureSampler(consumerCanonical, providerTileId);
        }
        if (!this.elevationFeatureSamplerCache) {
            this.elevationFeatureSamplerCache = new Map();
        }
        let sampler = this.elevationFeatureSamplerCache.get(providerTileId.key);
        if (!sampler) {
            sampler = new ElevationFeatureSampler(consumerCanonical, providerTileId);
            this.elevationFeatureSamplerCache.set(providerTileId.key, sampler);
        }
        return sampler;
    }

    isCrossTileRoadElevation(elevationFeatureIndex: number, consumerCanonical: CanonicalTileID): boolean {
        if (elevationFeatureIndex === 0xffff || elevationFeatureIndex >= this.elevationFeatures.length) {
            return false;
        }
        const providerTileId = this.elevationFeatureTileIds[elevationFeatureIndex];
        return providerTileId != null && !providerTileId.equals(consumerCanonical);
    }

    /**
     * Sample road-markup feature height at an anchor in consumer-tile space. Uses
     * `ElevationFeatureSampler` when the provider tile differs (mirrors `updateRoadElevation`).
     */
    getRoadFeatureHeightAtAnchor(
        elevationFeatureIndex: number,
        anchor: Point,
        consumerCanonical: CanonicalTileID,
    ): number | null {
        if (elevationFeatureIndex === 0xffff || elevationFeatureIndex >= this.elevationFeatures.length) {
            return null;
        }
        const elevationFeature = this.elevationFeatures[elevationFeatureIndex]!;
        const providerTileId = this.elevationFeatureTileIds[elevationFeatureIndex]!;
        if (providerTileId.equals(consumerCanonical)) {
            return elevationFeature.pointElevation(anchor);
        }
        return this.getElevationFeatureSampler(consumerCanonical, providerTileId)
            .pointElevation(new Point(anchor.x, anchor.y), elevationFeature, 0);
    }

    private sampleRoadFeatureHeight(
        elevationFeatureIndex: number,
        anchor: Point,
        consumerCanonical: CanonicalTileID,
    ): number | undefined {
        const height = this.getRoadFeatureHeightAtAnchor(elevationFeatureIndex, anchor, consumerCanonical);
        return height === null ? undefined : height;
    }

    /**
     * Worker-only lookup state must not cross the worker→main transfer. Resolution
     * completes during populate; the main thread only needs baked features + tile ids.
     */
    clearWorkerState(): void {
        this.consumerCanonical = undefined;
        this.elevationParams = null;
        this.crossSourceElevationEnabled = false;
        this.terrainEnabled = false;
        // Keep hasDeferredElevationFeatures — worker_tile reads it after layout
        // to schedule elevation-provider reparse.
        this.elevationFeatureIdToIndex.clear();
    }

    /**
     * Invoked once per bucket after placement resolves symbol positions. Reads per-symbol
     * elevation from `elevationFeatures`, writes z-offsets into the bucket's text/icon
     * `zOffset` field and computes per-vertex orientation that gets emplaced into the
     * bucket's `orientationVertexArray`s.
     */
    updateRoadElevation(bucket: SymbolBucket, canonical: CanonicalTileID): void {
        if (this.elevationStateComplete) {
            // Road elevation is updated only once
            return;
        }

        this.elevationStateComplete = true;
        bucket.hasAnyZOffset = false;
        let dataChanged = false;

        const tileToMeters = tileToMeter(canonical);
        const metersToTile = 1.0 / tileToMeters;
        let hasTextOrientation = false;
        let hasIconOrientation = false;

        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances.get(s);
            const orientedXAxis = vec3.fromValues(1, 0, 0);
            const orientedYAxis = vec3.fromValues(0, 1, 0);

            const {
                numHorizontalGlyphVertices,
                numVerticalGlyphVertices,
                numIconVertices,
                numVerticalIconVertices
            } = symbolInstance;

            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = numIconVertices > 0;

            const elevationFeatureIndex = symbolInstance.elevationFeatureIndex;
            const elevationFeature = elevationFeatureIndex < this.elevationFeatures.length ?
                this.elevationFeatures[elevationFeatureIndex] : undefined;
            if (elevationFeature) {
                // Add 7.5cm offset to reduce z-fighting issues
                const anchor = new Point(symbolInstance.tileAnchorX, symbolInstance.tileAnchorY);
                const roadHeight = this.sampleRoadFeatureHeight(elevationFeatureIndex, anchor, canonical);
                const newZOffset = roadHeight !== undefined ? 0.075 + roadHeight : 0.075;
                if (symbolInstance.zOffset !== newZOffset) {
                    dataChanged = true;
                    symbolInstance.zOffset = newZOffset;
                }

                if (newZOffset !== 0) {
                    bucket.hasAnyZOffset = true;
                }

                const slopeNormal = elevationFeature.computeSlopeNormal(anchor, metersToTile);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const rotation = quat.rotationTo(quat.create(), vec3.fromValues(0, 0, 1), slopeNormal);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                vec3.transformQuat(orientedXAxis, orientedXAxis, rotation);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                vec3.transformQuat(orientedYAxis, orientedYAxis, rotation);

                orientedXAxis[2] *= tileToMeters;
                orientedYAxis[2] *= tileToMeters;

                // Check for existence of non-default orientation data
                if (orientedXAxis[0] !== 1.0 || orientedXAxis[1] !== 0.0 || orientedXAxis[2] !== 0.0 ||
                    orientedYAxis[0] !== 0.0 || orientedYAxis[1] !== 1.0 || orientedYAxis[2] !== 0.0) {
                    hasTextOrientation = hasTextOrientation || hasText;
                    hasIconOrientation = hasIconOrientation || hasIcon;
                }
            }

            if (hasText) {
                addOrientationVertex(bucket.text.orientationVertexArray, numHorizontalGlyphVertices, orientedXAxis, orientedYAxis);
                addOrientationVertex(bucket.text.orientationVertexArray, numVerticalGlyphVertices, orientedXAxis, orientedYAxis);
            }
            if (hasIcon) {
                const {placedIconSymbolIndex, verticalPlacedIconSymbolIndex} = symbolInstance;
                if (placedIconSymbolIndex >= 0) {
                    addOrientationVertex(bucket.icon.orientationVertexArray, numIconVertices, orientedXAxis, orientedYAxis);
                }

                if (verticalPlacedIconSymbolIndex >= 0) {
                    addOrientationVertex(bucket.icon.orientationVertexArray, numVerticalIconVertices, orientedXAxis, orientedYAxis);
                }
            }
        }

        // If there is no orientation data, clear the vertex arrays so vertex buffers won't be created.
        if (!hasTextOrientation) {
            bucket.text.orientationVertexArray = (undefined)!;
        }
        if (!hasIconOrientation) {
            bucket.icon.orientationVertexArray = (undefined)!;
        }

        if (dataChanged) {
            bucket.zOffsetBuffersNeedUpload = true;
            bucket.zOffsetSortDirty = true;
        }
    }

    getRoadFeatureHeightForPlacedSymbol(
        bucket: SymbolBucket,
        buffers: SymbolBuffers,
        placedSymbolIdx: number,
        anchor: Point,
        consumerCanonical: CanonicalTileID,
    ): number | null {
        assert(buffers.symbolInstanceIndices.length === buffers.placedSymbolArray.length);
        const symbolInstanceIndex = buffers.symbolInstanceIndices[placedSymbolIdx];
        const symbolInstance = bucket.symbolInstances.get(symbolInstanceIndex!);
        assert(symbolInstance);
        return this.getRoadFeatureHeightAtAnchor(
            symbolInstance.elevationFeatureIndex, anchor, consumerCanonical);
    }

    getElevationFeatureForPlacedSymbol(bucket: SymbolBucket, buffers: SymbolBuffers, placedSymbolIdx: number): ElevationFeature | undefined {
        assert(buffers.symbolInstanceIndices.length === buffers.placedSymbolArray.length);
        const symbolInstanceIndex = buffers.symbolInstanceIndices[placedSymbolIdx];
        const symbolInstance = bucket.symbolInstances.get(symbolInstanceIndex!);
        assert(symbolInstance);
        const elevationFeatureIndex = symbolInstance.elevationFeatureIndex;
        assert(elevationFeatureIndex === 0xffff || elevationFeatureIndex < this.elevationFeatures.length);

        if (elevationFeatureIndex < this.elevationFeatures.length) {
            return this.elevationFeatures[elevationFeatureIndex];
        }
        return undefined;
    }

    /**
     * Build `ElevationParams` for road-markup symbol CPU elevation. Same-tile symbols keep
     * the legacy elevationFeature path; cross-tile uses the elevation feature sampler.
     */
    makeRoadSymbolElevationParams(
        bucket: SymbolBucket,
        buffers: SymbolBuffers,
        placedSymbolIdx: number,
        tileID: OverscaledTileID,
        getElevation: GetElevation,
        elevation: Elevation | null,
        projection: Projection,
        lat: number,
        worldSize: number,
    ): ElevationParams {
        const elevationFeature = this.getElevationFeatureForPlacedSymbol(bucket, buffers, placedSymbolIdx);
        const elevationFeatureOrNull = elevationFeature !== undefined ? elevationFeature : null;
        const symbolInstance = bucket.symbolInstances.get(buffers.symbolInstanceIndices[placedSymbolIdx]!);
        if (!this.isCrossTileRoadElevation(symbolInstance.elevationFeatureIndex, tileID.canonical)) {
            return {getElevation, elevation, elevationFeature: elevationFeatureOrNull};
        }
        return {
            getElevation: (p: Point) => {
                const roadHeight = this.getRoadFeatureHeightForPlacedSymbol(
                    bucket, buffers, placedSymbolIdx, p, tileID.canonical);
                const h = roadHeight !== null ? roadHeight : 0;
                return offsetVectorFromFeatureHeight(h, tileID.canonical, p, projection, lat, worldSize);
            },
            elevation,
            elevationFeature: null,
        };
    }
}

/**
 * Attach a `SymbolHDExtension` to the bucket if its layer declares
 * `symbol-elevation-reference: 'hd-road-markup'`. Called by `worker_tile.ts` immediately
 * after SymbolBucket construction, before `populate()` runs — reads the raw layout
 * property because `elevationType` hasn't been assigned yet at this point.
 *
 * @private
 */
export function maybeAttachSymbolHDExt(bucket: SymbolBucket): void {
    const elevationReference = bucket.layers[0]!.layout.get('symbol-elevation-reference');
    if (elevationReference === 'hd-road-markup') {
        bucket.hdExt = new SymbolHDExtension();
    }
}

register(SymbolHDExtension, 'SymbolHDExtension', {
    omit: [
        'consumerCanonical',
        'elevationParams',
        'crossSourceElevationEnabled',
        'terrainEnabled',
        'hasDeferredElevationFeatures',
        'elevationFeatureIdToIndex',
    ],
});
