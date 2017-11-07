// @flow

const StyleLayer = require('../style_layer');
const FillBucket = require('../../data/bucket/fill_bucket');
const {multiPolygonIntersectsMultiPolygon} = require('../../util/intersection_tests');
const {translateDistance, translate} = require('../query_utils');

import type {Feature, GlobalProperties} from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';

class FillStyleLayer extends StyleLayer {

    getPaintValue(name: string, globals: GlobalProperties, feature?: Feature) {
        if (name === 'fill-outline-color') {
            // Special-case handling of undefined fill-outline-color values
            if (this.getPaintProperty('fill-outline-color') === undefined) {
                return super.getPaintValue('fill-color', globals, feature);
            }

            // Handle transitions from fill-outline-color: undefined
            let transition = this._paintTransitions['fill-outline-color'];
            while (transition) {
                const declaredValue = (
                    transition &&
                    transition.declaration &&
                    transition.declaration.value
                );

                if (!declaredValue) {
                    return super.getPaintValue('fill-color', globals, feature);
                }

                transition = transition.oldTransition;
            }
        }

        return super.getPaintValue(name, globals, feature);
    }

    getPaintInterpolationFactor(name: string, ...args: *) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintInterpolationFactor('fill-color', ...args);
        } else {
            return super.getPaintInterpolationFactor(name, ...args);
        }
    }

    isPaintValueFeatureConstant(name: string) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.isPaintValueFeatureConstant('fill-color');
        } else {
            return super.isPaintValueFeatureConstant(name);
        }
    }

    isPaintValueZoomConstant(name: string) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.isPaintValueZoomConstant('fill-color');
        } else {
            return super.isPaintValueZoomConstant(name);
        }
    }

    createBucket(parameters: BucketParameters) {
        return new FillBucket(parameters);
    }

    isOpacityZero(zoom: number) {
        return this.isPaintValueFeatureConstant('fill-opacity') &&
            this.getPaintValue('fill-opacity', { zoom: zoom }) === 0;
    }

    queryRadius(): number {
        return translateDistance(this.paint['fill-translate']);
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           bearing: number,
                           pixelsToTileUnits: number): boolean {
        const translatedPolygon = translate(queryGeometry,
            this.getPaintValue('fill-translate', {zoom}, feature),
            this.getPaintValue('fill-translate-anchor', {zoom}, feature),
            bearing, pixelsToTileUnits);
        return multiPolygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }
}

module.exports = FillStyleLayer;
