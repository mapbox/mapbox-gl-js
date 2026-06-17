import Point from '@mapbox/point-geometry';
import {register} from '../../../src/util/web_worker_transfer';
import {CircleExtLayoutArray} from '../../../src/data/array_types';
import {circleAttributesExt} from '../../../src/data/bucket/circle_attributes';
import {getElevationFeature} from '../../elevation/get_elevation_feature';

import type {ElevationFeature} from '../../elevation/elevation_feature';
import type {BucketFeature} from '../../../src/data/bucket';
import type {CanonicalTileID} from '../../../src/source/tile_id';
import type CircleBucket from '../../../src/data/bucket/circle_bucket';
import type CircleStyleLayer from '../../../src/style/style_layer/circle_style_layer';
import type HeatmapStyleLayer from '../../../src/style/style_layer/heatmap_style_layer';
import type Context from '../../../src/gl/context';
import type VertexBuffer from '../../../src/gl/vertex_buffer';

/**
 * HD extension for CircleBucket. Owns the parallel elevated vertex array/buffer used
 * when a circle layer declares `circle-elevation-reference: 'hd-road-markup'`.
 *
 * Circle integrates differently from fill/line: the bucket keeps its own inner
 * point-iteration loop and calls into the extension per-point, rather than handing off
 * feature routing. The extension stashes the current feature's elevation in
 * `beginFeature` and consumes it in `writeVertexQuad` — a two-call dance that keeps HD
 * types out of the core bucket signatures.
 *
 * @private
 */
export class CircleHDExtension {
    elevatedLayoutVertexArray: CircleExtLayoutArray | undefined;
    elevatedLayoutVertexBuffer: VertexBuffer | undefined;
    hasElevation: boolean;
    private currentFeatureElevation: ElevationFeature | undefined;

    constructor() {
        this.elevatedLayoutVertexArray = new CircleExtLayoutArray();
        this.hasElevation = false;
    }

    beginFeature(
        feature: BucketFeature,
        elevationFeatures: ElevationFeature[] | undefined,
        canonical: CanonicalTileID,
    ): void {
        const tiled = getElevationFeature(feature, elevationFeatures, undefined, canonical);
        this.currentFeatureElevation = tiled ? tiled.feature : undefined;
    }

    writeVertexQuad(x: number, y: number): void {
        const z = this.currentFeatureElevation ? this.currentFeatureElevation.pointElevation(new Point(x, y)) : 0.0;
        this.hasElevation = this.hasElevation || z !== 0.0;
        for (let i = 0; i < 4; i++) {
            this.elevatedLayoutVertexArray.emplaceBack(z);
        }
    }

    /**
     * Called after CircleBucket.populate() completes. Drops the elevated vertex array
     * when no feature contributed a non-zero height so the unused allocation doesn't
     * survive into the transferred bucket.
     */
    finalize(): void {
        if (!this.hasElevation) {
            this.elevatedLayoutVertexArray = undefined;
        }
    }

    upload(context: Context): void {
        if (this.elevatedLayoutVertexArray && !this.elevatedLayoutVertexBuffer) {
            this.elevatedLayoutVertexBuffer = context.createVertexBuffer(this.elevatedLayoutVertexArray, circleAttributesExt.members);
        }
    }

    destroy(): void {
        if (this.elevatedLayoutVertexBuffer) {
            this.elevatedLayoutVertexBuffer.destroy();
        }
    }
}

/**
 * Attach a `CircleHDExtension` to the bucket if its layer declares HD elevation.
 * Called by `worker_tile.ts` immediately after CircleBucket construction, BEFORE
 * `populate()` runs — so we inspect the raw layer property rather than a computed
 * bucket field (which isn't assigned yet at this point).
 *
 * HeatmapStyleLayer shares CircleBucket but has no `circle-elevation-reference`
 * property — the `.get()` falls back to the 'none' default, so heatmap buckets
 * never attach an extension.
 *
 * @private
 */
export function maybeAttachCircleHDExt(bucket: CircleBucket<CircleStyleLayer | HeatmapStyleLayer>): void {
    const layer = bucket.layers[0];
    if (layer.type !== 'circle') return;
    const mode = layer.layout.get('circle-elevation-reference');
    if (mode === 'hd-road-markup') {
        bucket.hdExt = new CircleHDExtension();
    }
}

register(CircleHDExtension, 'CircleHDExtension');
