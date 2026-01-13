import StyleLayer from '../../../src/style/style_layer';
import {BuildingBucket, BUILDING_VISIBLE} from '../../data/bucket/building_bucket';
import {getLayoutProperties, getPaintProperties} from './building_style_layer_properties';
import {checkIntersection, projectExtrusion} from '../../../src/style/style_layer/fill_extrusion_style_layer';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

import type {Layout, Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../../../src/style/properties';
import type {Bucket, BucketParameters} from '../../../src/data/bucket';
import type {DEMSampler} from '../../../src/terrain/elevation';
import type {FeatureState} from '../../../src/style-spec/expression';
import type {PaintProps, LayoutProps} from './building_style_layer_properties';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {LUT} from "../../../src/util/lut";
import type {TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type Transform from '../../../src/geo/transform';
import type {VectorTileFeature} from '@mapbox/vector-tile';

class BuildingStyleLayer extends StyleLayer {
    override type: 'building';

    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this._stats = {numRenderedVerticesInShadowPass: 0, numRenderedVerticesInTransparentPass: 0};
    }

    createBucket(parameters: BucketParameters<BuildingStyleLayer>): BuildingBucket {
        return new BuildingBucket(parameters);
    }

    override cutoffRange(): number {
        return this.paint.get('building-cutoff-fade-range');
    }

    override hasShadowPass(): boolean {
        return this.paint.get('building-cast-shadows');
    }

    override hasLightBeamPass(): boolean {
        return true;
    }

    override canCastShadows(): boolean {
        return true;
    }

    override is3D(terrainEnabled?: boolean): boolean {
        return true;
    }

    override queryRadius(bucket: Bucket): number {
        return 0;
    }

    override queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
        pixelPosMatrix: Float32Array,
        elevationHelper: DEMSampler | null | undefined,
        layoutVertexArrayOffset: number,
        scope: string | undefined
    ): boolean | number {
        let height = this.layout.get('building-height').evaluate(feature, featureState);
        const base = this.layout.get('building-base').evaluate(feature, featureState);

        const bucket = queryGeometry.tile.getBucket(this);
        assert(bucket instanceof BuildingBucket);
        const footprint = bucket.getFootprint(feature);
        if (footprint) {
            if (footprint.hiddenFlags !== BUILDING_VISIBLE) {
                return false;
            }
            height = footprint.height;
        }

        const demSampler: DEMSampler | null = null;
        const centroid: [number, number] = [0, 0];
        const exaggeration = 1;
        const [projectedBase, projectedTop] = projectExtrusion(transform, geometry, base, height, new Point(0.0, 0.0), pixelPosMatrix, demSampler, centroid, exaggeration, transform.center.lat, queryGeometry.tileID.canonical);

        const screenQuery = queryGeometry.queryGeometry;
        const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
    }
}

export default BuildingStyleLayer;
