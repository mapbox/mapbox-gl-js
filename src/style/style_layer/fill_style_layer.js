// @flow

const StyleLayer = require('../style_layer');
const FillBucket = require('../../data/bucket/fill_bucket');

import type {GlobalProperties, FeatureProperties} from '../style_layer';
import type {BucketParameters} from '../../data/bucket';

class FillStyleLayer extends StyleLayer {

    getPaintValue(name: string, globalProperties?: GlobalProperties, featureProperties?: FeatureProperties) {
        if (name === 'fill-outline-color') {
            // Special-case handling of undefined fill-outline-color values
            if (this.getPaintProperty('fill-outline-color') === undefined) {
                return super.getPaintValue('fill-color', globalProperties, featureProperties);
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
                    return super.getPaintValue('fill-color', globalProperties, featureProperties);
                }

                transition = transition.oldTransition;
            }
        }

        return super.getPaintValue(name, globalProperties, featureProperties);
    }

    getPaintValueStopZoomLevels(name: string) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintValueStopZoomLevels('fill-color');
        } else {
            return super.getPaintValueStopZoomLevels(name);
        }
    }

    getPaintInterpolationT(name: string, globalProperties: GlobalProperties) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintInterpolationT('fill-color', globalProperties);
        } else {
            return super.getPaintInterpolationT(name, globalProperties);
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
}

module.exports = FillStyleLayer;
