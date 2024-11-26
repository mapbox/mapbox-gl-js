import StyleLayer from '../style_layer';
import CircleBucket from '../../data/bucket/circle_bucket';
import {polygonIntersectsBufferedPoint} from '../../util/intersection_tests';
import {getMaximumPaintValue, translateDistance, tilespaceTranslate} from '../query_utils';
import {getLayoutProperties, getPaintProperties} from './circle_style_layer_properties';
import {vec4, vec3} from 'gl-matrix';
import Point from '@mapbox/point-geometry';
import ProgramConfiguration from '../../data/program_configuration';
import assert from 'assert';
import {latFromMercatorY, mercatorZfromAltitude} from '../../geo/mercator_coordinate';
import EXTENT from '../../style-spec/data/extent';
import {circleDefinesValues} from '../../render/program/circle_program';

import type {Transitionable, Transitioning, Layout, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {Ray} from '../../util/primitives';
import type {FeatureState} from '../../style-spec/expression/index';
import type Transform from '../../geo/transform';
import type {Bucket, BucketParameters} from '../../data/bucket';
import type {LayoutProps, PaintProps} from './circle_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {DEMSampler} from '../../terrain/elevation';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from '../../render/painter';
import type {DynamicDefinesType} from '../../render/program/program_uniforms';
import type {LUT} from "../../util/lut";

class CircleStyleLayer extends StyleLayer {
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
    }

    createBucket(parameters: BucketParameters<CircleStyleLayer>): CircleBucket<CircleStyleLayer> {
        return new CircleBucket(parameters);
    }

    override queryRadius(bucket: Bucket): number {
        const circleBucket: CircleBucket<CircleStyleLayer> = (bucket as any);
        return getMaximumPaintValue('circle-radius', this, circleBucket) +
            getMaximumPaintValue('circle-stroke-width', this, circleBucket) +

            translateDistance(this.paint.get('circle-translate'));
    }

    override queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
        pixelPosMatrix: Float32Array,
        elevationHelper?: DEMSampler | null,
    ): boolean {
        const translation = tilespaceTranslate(
            this.paint.get('circle-translate'),
            this.paint.get('circle-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor
        );

        const size = this.paint.get('circle-radius').evaluate(feature, featureState) +
            this.paint.get('circle-stroke-width').evaluate(feature, featureState);

        return queryIntersectsCircle(queryGeometry, geometry, transform, pixelPosMatrix, elevationHelper,
            this.paint.get('circle-pitch-alignment') === 'map',
            this.paint.get('circle-pitch-scale') === 'map', translation, size);
    }

    override getProgramIds(): Array<string> {
        return ['circle'];
    }

    override getDefaultProgramParams(_: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        const definesValues = (circleDefinesValues(this) as DynamicDefinesType[]);
        return {
            config: new ProgramConfiguration(this, {zoom, lut}),
            defines: definesValues,
            overrideFog: false
        };
    }
}

export function queryIntersectsCircle(
    queryGeometry: TilespaceQueryGeometry,
    geometry: Array<Array<Point>>,
    transform: Transform,
    pixelPosMatrix: Float32Array,
    elevationHelper: DEMSampler | null | undefined,
    alignWithMap: boolean,
    scaleWithMap: boolean,
    translation: Point,
    size: number,
): boolean {
    if (alignWithMap && queryGeometry.queryGeometry.isAboveHorizon) return false;

    // For pitch-alignment: map, compare feature geometry to query geometry in the plane of the tile
    // // Otherwise, compare geometry in the plane of the viewport
    // // A circle with fixed scaling relative to the viewport gets larger in tile space as it moves into the distance
    // // A circle with fixed scaling relative to the map gets smaller in viewport space as it moves into the distance
    if (alignWithMap) size *= queryGeometry.pixelToTileUnitsFactor;

    const tileId = queryGeometry.tileID.canonical;
    const elevationScale = transform.projection.upVectorScale(tileId, transform.center.lat, transform.worldSize).metersToTile;

    for (const ring of geometry) {
        for (const point of ring) {
            const translatedPoint = point.add(translation);
            const z = (elevationHelper && transform.elevation) ?
                transform.elevation.exaggeration() * elevationHelper.getElevationAt(translatedPoint.x, translatedPoint.y, true) :
                0;

            // Reproject tile coordinate to the local coordinate space used by the projection
            const reproj = transform.projection.projectTilePoint(translatedPoint.x, translatedPoint.y, tileId);

            if (z > 0) {
                const dir = transform.projection.upVector(tileId, translatedPoint.x, translatedPoint.y);
                reproj.x += dir[0] * elevationScale * z;
                reproj.y += dir[1] * elevationScale * z;
                reproj.z += dir[2] * elevationScale * z;
            }

            const transformedPoint = alignWithMap ? translatedPoint : projectPoint(reproj.x, reproj.y, reproj.z, pixelPosMatrix);
            const transformedPolygon = alignWithMap ?
                queryGeometry.tilespaceRays.map((r) => intersectAtHeight(r, z)) :
                queryGeometry.queryGeometry.screenGeometry;

            const projectedCenter = vec4.transformMat4([] as any, [reproj.x, reproj.y, reproj.z, 1], pixelPosMatrix);
            if (!scaleWithMap && alignWithMap) {
                size *= projectedCenter[3] / transform.cameraToCenterDistance;
            } else if (scaleWithMap && !alignWithMap) {
                size *= transform.cameraToCenterDistance / projectedCenter[3];
            }

            if (alignWithMap) {
                // Apply extra scaling to cover different pixelPerMeter ratios at different latitudes
                const lat = latFromMercatorY((point.y / EXTENT + tileId.y) / (1 << tileId.z));
                const scale = transform.projection.pixelsPerMeter(lat, 1) / mercatorZfromAltitude(1, lat);

                size /= scale;
            }

            if (polygonIntersectsBufferedPoint(transformedPolygon, transformedPoint, size)) return true;
        }
    }

    return false;
}

function projectPoint(x: number, y: number, z: number, pixelPosMatrix: Float32Array) {
    const point = vec4.transformMat4([] as any, [x, y, z, 1], pixelPosMatrix);
    return new Point(point[0] / point[3], point[1] / point[3]);
}

const origin = vec3.fromValues(0, 0, 0);
const up = vec3.fromValues(0, 0, 1);

function intersectAtHeight(r: Ray, z: number): Point {
    const intersectionPt = vec3.create();
    origin[2] = z;
    const intersects = r.intersectsPlane(origin, up, intersectionPt);
    assert(intersects, 'tilespacePoint should always be below horizon, and since camera cannot have pitch >90, ray should always intersect');

    return new Point(intersectionPt[0], intersectionPt[1]);
}

export default CircleStyleLayer;
