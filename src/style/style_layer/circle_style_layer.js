// @flow

import StyleLayer from '../style_layer.js';

import CircleBucket from '../../data/bucket/circle_bucket.js';
import {polygonIntersectsBufferedPoint} from '../../util/intersection_tests.js';
import {getMaximumPaintValue, translateDistance, tilespaceTranslate} from '../query_utils.js';
import properties from './circle_style_layer_properties.js';
import {Transitionable, Transitioning, Layout, PossiblyEvaluated} from '../properties.js';
import {vec4, vec3} from 'gl-matrix';
import Point from '@mapbox/point-geometry';
import ProgramConfiguration from '../../data/program_configuration.js';
import {Ray} from '../../util/primitives.js';
import assert from 'assert';

import type {FeatureState} from '../../style-spec/expression/index.js';
import type Transform from '../../geo/transform.js';
import type {Bucket, BucketParameters} from '../../data/bucket.js';
import type {LayoutProps, PaintProps} from './circle_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../query_geometry.js';
import type {DEMSampler} from '../../terrain/elevation.js';

class CircleStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<LayoutProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<*>) {
        return new CircleBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const circleBucket: CircleBucket<CircleStyleLayer> = (bucket: any);
        return getMaximumPaintValue('circle-radius', this, circleBucket) +
            getMaximumPaintValue('circle-stroke-width', this, circleBucket) +
            translateDistance(this.paint.get('circle-translate'));
    }

    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelPosMatrix: Float32Array,
                           elevationHelper: ?DEMSampler): boolean {

        const translation = tilespaceTranslate(
            this.paint.get('circle-translate'),
            this.paint.get('circle-translate-anchor'),
            transform.angle, queryGeometry.pixelToTileUnitsFactor);

        const size = this.paint.get('circle-radius').evaluate(feature, featureState) +
            this.paint.get('circle-stroke-width').evaluate(feature, featureState);

        return queryIntersectsCircle(queryGeometry, geometry, transform, pixelPosMatrix, elevationHelper,
            this.paint.get('circle-pitch-alignment') === 'map',
            this.paint.get('circle-pitch-scale') === 'map', translation, size);
    }

    getProgramIds() {
        return ['circle'];
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export function queryIntersectsCircle(queryGeometry: TilespaceQueryGeometry,
                       geometry: Array<Array<Point>>,
                       transform: Transform,
                       pixelPosMatrix: Float32Array,
                       elevationHelper: ?DEMSampler,
                       alignWithMap: boolean,
                       scaleWithMap: boolean,
                       translation: Point,
                       size: number): boolean {
    if (alignWithMap && queryGeometry.queryGeometry.isAboveHorizon) return false;

    // For pitch-alignment: map, compare feature geometry to query geometry in the plane of the tile
    // // Otherwise, compare geometry in the plane of the viewport
    // // A circle with fixed scaling relative to the viewport gets larger in tile space as it moves into the distance
    // // A circle with fixed scaling relative to the map gets smaller in viewport space as it moves into the distance
    if (alignWithMap) size *= queryGeometry.pixelToTileUnitsFactor;

    for (const ring of geometry) {
        for (const point of ring) {
            const translatedPoint = point.add(translation);
            const z = (elevationHelper && transform.elevation) ?
                transform.elevation.exaggeration() * elevationHelper.getElevationAt(translatedPoint.x, translatedPoint.y, true) :
                0;

            const transformedPoint = alignWithMap ? translatedPoint : projectPoint(translatedPoint, z, pixelPosMatrix);
            const transformedPolygon = alignWithMap ?
                queryGeometry.tilespaceRays.map((r) => intersectAtHeight(r, z)) :
                queryGeometry.queryGeometry.screenGeometry;

            const projectedCenter = vec4.transformMat4([], [point.x, point.y, z, 1], pixelPosMatrix);
            if (!scaleWithMap && alignWithMap) {
                size *= projectedCenter[3] / transform.cameraToCenterDistance;
            } else if (scaleWithMap && !alignWithMap) {
                size *= transform.cameraToCenterDistance / projectedCenter[3];
            }

            if (polygonIntersectsBufferedPoint(transformedPolygon, transformedPoint, size)) return true;
        }
    }

    return false;
}

function projectPoint(p: Point, z: number, pixelPosMatrix: Float32Array) {
    const point = vec4.transformMat4([], [p.x, p.y, z, 1], pixelPosMatrix);
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
