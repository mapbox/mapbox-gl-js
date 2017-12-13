// @flow

const StyleLayer = require('../style_layer');
const CircleBucket = require('../../data/bucket/circle_bucket');
const {multiPolygonIntersectsBufferedMultiPoint} = require('../../util/intersection_tests');
const {getMaximumPaintValue, translateDistance, translate} = require('../query_utils');
const properties = require('./circle_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type {Bucket, BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
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
                           bearing: number,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('circle-translate'),
            this.paint.get('circle-translate-anchor'),
            bearing, pixelsToTileUnits);
        const radius = this.paint.get('circle-radius').evaluate(feature) * pixelsToTileUnits;
        const stroke = this.paint.get('circle-stroke-width').evaluate(feature) * pixelsToTileUnits;
        return multiPolygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, radius + stroke);
    }
}

module.exports = CircleStyleLayer;
