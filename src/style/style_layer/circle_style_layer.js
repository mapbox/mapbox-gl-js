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

    isOpacityZero(zoom: number) {
        return this.isPaintValueFeatureConstant('circle-opacity') &&
            this.getPaintValue('circle-opacity', { zoom: zoom }) === 0 &&
            (this.isPaintValueFeatureConstant('circle-stroke-width') &&
                this.getPaintValue('circle-stroke-width', { zoom: zoom }) === 0) ||
            (this.isPaintValueFeatureConstant('circle-stroke-opacity') &&
                this.getPaintValue('circle-stroke-opacity', { zoom: zoom }) === 0);
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
            this.getPaintValue('circle-translate', {zoom}, feature),
            this.getPaintValue('circle-translate-anchor', {zoom}, feature),
            bearing, pixelsToTileUnits);
        const circleRadius = this.getPaintValue('circle-radius', {zoom}, feature) * pixelsToTileUnits;
        return multiPolygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, circleRadius);
    }
}

module.exports = CircleStyleLayer;
