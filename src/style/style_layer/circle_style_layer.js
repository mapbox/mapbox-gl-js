// @flow

const StyleLayer = require('../style_layer');
const CircleBucket = require('../../data/bucket/circle_bucket');
const {multiPolygonIntersectsBufferedMultiPoint} = require('../../util/intersection_tests');
const {getMaximumPaintValue, translateDistance, translate} = require('../query_utils');

import type {Bucket, BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';

class CircleStyleLayer extends StyleLayer {
    createBucket(parameters: BucketParameters) {
        return new CircleBucket(parameters);
    }

    queryRadius(bucket: Bucket): number {
        const circleBucket: CircleBucket = (bucket: any);
        return getMaximumPaintValue('circle-radius', this, circleBucket) +
            translateDistance(this.paint['circle-translate']);
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           bearing: number,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.getPaintValue('circle-translate', {zoom}, feature.properties),
            this.getPaintValue('circle-translate-anchor', {zoom}, feature.properties),
            bearing, pixelsToTileUnits);
        const circleRadius = this.getPaintValue('circle-radius', {zoom}, feature.properties) * pixelsToTileUnits;
        return multiPolygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, circleRadius);
    }
}

module.exports = CircleStyleLayer;
