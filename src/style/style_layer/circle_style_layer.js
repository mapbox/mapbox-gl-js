// @flow

const StyleLayer = require('../style_layer');
const CircleBucket = require('../../data/bucket/circle_bucket');
const {multiPolygonIntersectsBufferedPoint} = require('../../util/intersection_tests');
const {getMaximumPaintValue, translateDistance, translate} = require('../query_utils');
const properties = require('./circle_style_layer_properties');
const {vec4} = require('@mapbox/gl-matrix');
const Point = require('@mapbox/point-geometry');

import type Transform from '../../geo/transform';

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type {Bucket, BucketParameters} from '../../data/bucket';
import type {PaintProps} from './circle_style_layer_properties';

class CircleStyleLayer extends StyleLayer {
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

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number,
                           posMatrix: Float32Array): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('circle-translate'),
            this.paint.get('circle-translate-anchor'),
            transform.angle, pixelsToTileUnits);
        const radius = this.paint.get('circle-radius').evaluate(feature);
        const stroke = this.paint.get('circle-stroke-width').evaluate(feature);
        const size  = radius + stroke;

        // For pitch-alignment: map, compare feature geometry to query geometry in the plane of the tile
        // // Otherwise, compare geometry in the plane of the viewport
        // // A circle with fixed scaling relative to the viewport gets larger in tile space as it moves into the distance
        // // A circle with fixed scaling relative to the map gets smaller in viewport space as it moves into the distance
        const alignWithMap = this.paint.get('circle-pitch-alignment') === 'map';
        const transformedPolygon = alignWithMap ? translatedPolygon : projectQueryGeometry(translatedPolygon, posMatrix, transform);
        const transformedSize = alignWithMap ? size * pixelsToTileUnits : size;

        for (const ring of geometry) {
            for (const point of ring) {

                const transformedPoint = alignWithMap ? point : projectPoint(point, posMatrix, transform);

                let adjustedSize = transformedSize;
                const projectedCenter = vec4.transformMat4([], [point.x, point.y, 0, 1], posMatrix);
                if (this.paint.get('circle-pitch-scale') === 'viewport' && this.paint.get('circle-pitch-alignment') === 'map') {
                    adjustedSize *= projectedCenter[3] / transform.cameraToCenterDistance;
                } else if (this.paint.get('circle-pitch-scale') === 'map' && this.paint.get('circle-pitch-alignment') === 'viewport') {
                    adjustedSize *= transform.cameraToCenterDistance / projectedCenter[3];
                }

                if (multiPolygonIntersectsBufferedPoint(transformedPolygon, transformedPoint, adjustedSize)) return true;
            }
        }

        return false;
    }
}

function projectPoint(p: Point, posMatrix: Float32Array, transform: Transform) {
    const point = vec4.transformMat4([], [p.x, p.y, 0, 1], posMatrix);
    return new Point(
            (point[0] / point[3] + 1) * transform.width * 0.5,
            (point[1] / point[3] + 1) * transform.height * 0.5);
}

function projectQueryGeometry(queryGeometry: Array<Array<Point>>, posMatrix: Float32Array, transform: Transform) {
    return queryGeometry.map((r) => {
        return r.map((p) => {
            return projectPoint(p, posMatrix, transform);
        });
    });
}

module.exports = CircleStyleLayer;
