import assert from '../../../src/style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import {register} from '../../../src/util/web_worker_transfer';
import ElevatedFillBufferData from './elevated_fill_buffer_data';
import {ElevatedStructures, type FeatureInfo} from '../../elevation/elevated_structures';
import {ElevationFeatureSampler, EdgeIterator, type ElevationFeature} from '../../elevation/elevation_feature';
import {getElevationFeature} from '../../elevation/get_elevation_feature';
import {ELEVATION_CLIP_MARGIN, MARKUP_ELEVATION_BIAS, PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL, SUBDIVISION_EDGE_EXTENSION} from '../../elevation/elevation_constants';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';
import {clip, polygonSubdivision} from '../../util/polygon_clipping_hd';
import EXTENT from '../../../src/style-spec/data/extent';
import {computeBounds} from '../../../src/style-spec/util/geometry_util';

import type {CanonicalTileID} from '../../../src/source/tile_id';
import type {BucketFeature} from '../../../src/data/bucket';
import type {FeatureStates} from '../../../src/source/source_state';
import type {SpritePositions} from '../../../src/util/image';
import type {ImageId} from '../../../src/style-spec/expression/types/image_id';
import type {TypedStyleLayer} from '../../../src/style/style_layer/typed_style_layer';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type Context from '../../../src/gl/context';
import type FillBucket from '../../../src/data/bucket/fill_bucket';
import type {ElevationPortalGraph} from '../../elevation/elevation_graph';

/**
 * Parameters threaded from the HD extension's polygon pass into `FillBucket.addGeometry`
 * so the shared polygon triangulation can emit elevated vertices and update
 * `ElevatedStructures` without having to know about the extension class. Co-located with
 * the extension so core only sees it as a structural shape.
 *
 * @private
 */
export type ElevationParams = {
    elevation: ElevationFeature;
    elevationSampler: ElevationFeatureSampler;
    bias: number;
    index: number;
    featureInfo: FeatureInfo;
};

/**
 * HD extension for FillBucket. Owns the elevated vertex buffer, elevated structures,
 * and the hd-road feature-routing path.
 *
 * @private
 */
export class FillHDExtension {
    elevationMode: 'hd-road-base' | 'hd-road-markup';
    elevationBufferData: ElevatedFillBufferData;
    elevatedStructures: ElevatedStructures | undefined;

    constructor(bucket: FillBucket, elevationMode: 'hd-road-base' | 'hd-road-markup') {
        this.elevationMode = elevationMode;
        this.elevationBufferData = new ElevatedFillBufferData(bucket.layers, bucket.zoom, bucket.lut);
    }

    isEmpty(): boolean {
        return this.elevationBufferData.isEmpty();
    }

    needsUpload(): boolean {
        return this.elevationBufferData.needsUpload();
    }

    /**
     * Per-feature dispatch from `FillBucket.addFeature`. Consumes the feature (writes to
     * the elevated buffer and optionally `elevatedStructures`) when tiled elevation data
     * is available for it; returns `false` to let FillBucket route the feature through
     * its normal non-elevated path — elevated-mode features with no tiled elevation
     * coverage render flat rather than being dropped.
     */
    handleFeature(
        feature: BucketFeature,
        polygons: Point[][][],
        index: number,
        canonical: CanonicalTileID,
        elevationFeatures: ElevationFeature[] | undefined,
        bucket: FillBucket,
    ): boolean {
        interface ElevatedGeometry {
            polygons: Point[][][];
            elevationFeature: ElevationFeature;
            elevationTileID: CanonicalTileID;
        }

        const elevatedGeometry = new Array<ElevatedGeometry>();

        // Layers using vector sources should always use the precomputed elevation.
        // In case of geojson sources the elevation snapshot will be used instead.
        const tiledElevation = getElevationFeature(feature, elevationFeatures);
        if (tiledElevation) {
            const clipped = this.clipPolygonsToTile(polygons, ELEVATION_CLIP_MARGIN);
            if (clipped.length > 0) {
                elevatedGeometry.push({polygons: clipped, elevationFeature: tiledElevation, elevationTileID: canonical});
            }
        } else {
            // No elevation data — fall through to the core flat-fill path.
            return false;
        }

        const constructBridgeGuardRail = bucket.layers[0].layout.get('fill-construct-bridge-guard-rail').evaluate(feature, {}, canonical);
        const featureInfo: FeatureInfo = {guardRailEnabled: constructBridgeGuardRail, featureIndex: index};

        for (const elevated of elevatedGeometry) {
            if (elevated.elevationFeature) {
                if (this.elevationMode === 'hd-road-base') {
                    if (!this.elevatedStructures) {
                        this.elevatedStructures = new ElevatedStructures(elevated.elevationTileID, bucket.layers, bucket.zoom, bucket.lut);
                    }

                    const isTunnel = elevated.elevationFeature.isTunnel();
                    let zLevel = 0;
                    if (Object.hasOwn(feature.properties, PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL)) {
                        zLevel = +feature.properties[PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL];
                    }

                    // Create "elevated structures" for polygons using "road" elevation mode that
                    // contains additional bridge and tunnel geometries for rendering. Additive "markup" features are
                    // stacked on top of another elevated layers and do not need these structures of their own.
                    // Overlapping edges between adjacent polygons form "portals", i.e. entry & exit points
                    // useful for traversing elevated polygons
                    this.elevatedStructures.addPortalCandidates(
                        elevated.elevationFeature.id, elevated.polygons, isTunnel, elevated.elevationFeature, zLevel
                    );
                }

                if (elevated.elevationFeature.constantHeight == null) {
                    elevated.polygons = this.prepareElevatedPolygons(elevated.polygons, elevated.elevationFeature, elevated.elevationTileID);
                }

                const elevationSampler = new ElevationFeatureSampler(canonical, elevated.elevationTileID);
                // Apply slight height bias to "markup" polygons to remove z-fighting against the base road surface.
                const bias = this.elevationMode === 'hd-road-base' ? 0.0 : MARKUP_ELEVATION_BIAS;
                this.addElevatedGeometry(bucket, elevated.polygons, elevationSampler, elevated.elevationFeature, bias, index, featureInfo);
            }
        }

        return true;
    }

    populatePaintArrays(
        feature: BucketFeature,
        index: number,
        imagePositions: SpritePositions,
        availableImages: ImageId[],
        canonical: CanonicalTileID,
        brightness: number | null | undefined,
        worldview: string,
    ): void {
        this.elevationBufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness, worldview);
    }

    update(
        states: FeatureStates,
        vtLayer: VectorTileLayer,
        availableImages: ImageId[],
        imagePositions: SpritePositions,
        layers: ReadonlyArray<TypedStyleLayer>,
        isBrightnessChanged: boolean,
        brightness: number | null | undefined,
        worldview: string,
    ): void {
        this.elevationBufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, worldview);
        if (this.elevatedStructures) {
            this.elevatedStructures.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, worldview);
        }
    }

    updateExpressions(layers: ReadonlyArray<TypedStyleLayer>): void {
        this.elevationBufferData.programConfigurations.updateExpressions(layers);
        if (this.elevatedStructures) {
            this.elevatedStructures.bridgeProgramConfigurations.updateExpressions(layers);
            this.elevatedStructures.tunnelProgramConfigurations.updateExpressions(layers);
        }
    }

    upload(context: Context): void {
        this.elevationBufferData.upload(context);
        if (this.elevatedStructures) {
            this.elevatedStructures.upload(context);
        }
    }

    destroy(): void {
        this.elevationBufferData.destroy();
        if (this.elevatedStructures) {
            this.elevatedStructures.destroy();
        }
    }

    getUnevaluatedPortalGraph(): ElevationPortalGraph | undefined {
        return this.elevatedStructures ? this.elevatedStructures.unevaluatedPortals : undefined;
    }

    setEvaluatedPortalGraph(
        graph: ElevationPortalGraph,
        vtLayer: VectorTileLayer,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness: number | null | undefined,
        worldview: string,
    ): void {
        if (this.elevatedStructures) {
            this.elevatedStructures.construct(graph);
            this.elevatedStructures.populatePaintArrays(vtLayer, canonical, availableImages, brightness, worldview);
        }
    }

    private addElevatedGeometry(
        bucket: FillBucket,
        polygons: Point[][][],
        elevationSampler: ElevationFeatureSampler,
        elevation: ElevationFeature,
        bias: number,
        index: number,
        featureInfo: FeatureInfo,
    ): void {
        const elevationParams: ElevationParams = {elevation, elevationSampler, bias, index, featureInfo};
        const [min, max] = bucket.addGeometry(polygons, this.elevationBufferData, elevationParams, this.elevatedStructures);

        if (this.elevationBufferData.heightRange == null) {
            this.elevationBufferData.heightRange = {min, max};
        } else {
            this.elevationBufferData.heightRange.min = Math.min(this.elevationBufferData.heightRange.min, min);
            this.elevationBufferData.heightRange.max = Math.max(this.elevationBufferData.heightRange.max, max);
        }
    }

    private prepareElevatedPolygons(polygons: Point[][][], elevation: ElevationFeature, tileID: CanonicalTileID): Point[][][] {
        // Subdivide the polygon along the assigned elevation curve
        const metersToTile = 1.0 / tileToMeter(tileID);
        const clippedPolygons: Point[][][] = [];

        for (const poly of polygons) {
            const clippedPoly = polygonSubdivision(poly, new EdgeIterator(elevation, metersToTile), SUBDIVISION_EDGE_EXTENSION);
            clippedPolygons.push(...clippedPoly);
        }

        return clippedPolygons;
    }

    private clipPolygonsToTile(polygons: Point[][][], margin: number): Point[][][] {
        const minX = -margin;
        const minY = -margin;
        const maxX = EXTENT + margin;
        const maxY = EXTENT + margin;

        // Find polygons potentially intersecting with boundaries and hence requiring clipping
        let clipIdx = 0;
        const noClippingGroup: Point[][][] = [];
        const clippingGroup: Point[][][] = [];

        for (; clipIdx < polygons.length; clipIdx++) {
            const polygon = polygons[clipIdx];
            assert(polygon.length > 0);

            const bounds = computeBounds(polygon);
            const noClipping = bounds.min.x >= minX && bounds.max.x <= maxX && bounds.min.y >= minY && bounds.max.y <= maxY;
            const dst = noClipping ? noClippingGroup : clippingGroup;
            dst.push(polygon);
        }

        if (noClippingGroup.length === polygons.length) return polygons;

        const clipPoly = [
            new Point(minX, minY),
            new Point(maxX, minY),
            new Point(maxX, maxY),
            new Point(minX, maxY),
            new Point(minX, minY)
        ];

        const clippedPolygons = noClippingGroup;
        for (const poly of clippingGroup) {
            clippedPolygons.push(...clip(poly, clipPoly));
        }

        return clippedPolygons;
    }
}

/**
 * Attach a `FillHDExtension` to the bucket if its layer declares a non-'none'
 * `fill-elevation-reference`. Idempotent no-op otherwise.
 *
 * Called by `worker_tile.ts` immediately after FillBucket construction. Keeping the
 * relevance check here (rather than inline in worker_tile) lets HD own the list of
 * layout properties that trigger attachment — adding new HD properties shouldn't
 * touch core.
 *
 * @private
 */
export function maybeAttachFillHDExt(bucket: FillBucket): void {
    const mode = bucket.layers[0].layout.get('fill-elevation-reference');
    if (mode === 'hd-road-base' || mode === 'hd-road-markup') {
        bucket.hdExt = new FillHDExtension(bucket, mode);
    }
}

register(FillHDExtension, 'FillHDExtension');
// ElevatedStructures is registered by the HD module because the class only lives in
// the HD bundle — the register side effect belongs with the module that uses it.
register(ElevatedStructures, 'ElevatedStructures');
