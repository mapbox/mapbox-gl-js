import assert from '../../../src/style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import {quat, vec3} from 'gl-matrix';
import {register} from '../../../src/util/web_worker_transfer';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';

import type {CanonicalTileID} from '../../../src/source/tile_id';
import type SymbolBucket from '../../../src/data/bucket/symbol_bucket';
import type {SymbolBuffers} from '../../../src/data/bucket/symbol_bucket';
import type {ElevationFeature} from '../../elevation/elevation_feature';
import type {SymbolOrientationArray} from '../../../src/data/array_types';

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
    elevationFeatureIdToIndex: Map<number, number>;
    elevationStateComplete: boolean;

    constructor() {
        this.elevationFeatures = [];
        this.elevationFeatureIdToIndex = new Map<number, number>();
        this.elevationStateComplete = false;
    }

    addElevationFeatures(features: ElevationFeature[]): void {
        for (const elevationFeature of features) {
            this.elevationFeatureIdToIndex.set(elevationFeature.id, this.elevationFeatures.length);
            this.elevationFeatures.push(elevationFeature);
        }
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

            const elevationFeature = this.elevationFeatures[symbolInstance.elevationFeatureIndex];
            if (elevationFeature) {
                // Add 7.5cm offset to reduce z-fighting issues
                const anchor = new Point(symbolInstance.tileAnchorX, symbolInstance.tileAnchorY);
                const newZOffset = 0.075 + elevationFeature.pointElevation(anchor);
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
            bucket.text.orientationVertexArray = undefined;
        }
        if (!hasIconOrientation) {
            bucket.icon.orientationVertexArray = undefined;
        }

        if (dataChanged) {
            bucket.zOffsetBuffersNeedUpload = true;
            bucket.zOffsetSortDirty = true;
        }
    }

    getElevationFeatureForPlacedSymbol(bucket: SymbolBucket, buffers: SymbolBuffers, placedSymbolIdx: number): ElevationFeature | undefined {
        assert(buffers.symbolInstanceIndices.length === buffers.placedSymbolArray.length);
        const symbolInstanceIndex = buffers.symbolInstanceIndices[placedSymbolIdx];
        const symbolInstance = bucket.symbolInstances.get(symbolInstanceIndex);
        assert(symbolInstance);
        const elevationFeatureIndex = symbolInstance.elevationFeatureIndex;
        assert(elevationFeatureIndex === 0xffff || elevationFeatureIndex < this.elevationFeatures.length);

        if (elevationFeatureIndex < this.elevationFeatures.length) {
            return this.elevationFeatures[elevationFeatureIndex];
        }
        return undefined;
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
    const elevationReference = bucket.layers[0].layout.get('symbol-elevation-reference');
    if (elevationReference === 'hd-road-markup') {
        bucket.hdExt = new SymbolHDExtension();
    }
}

register(SymbolHDExtension, 'SymbolHDExtension');
