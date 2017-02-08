'use strict';

const StyleLayer = require('../style_layer');
const FillBucket = require('../../data/bucket/fill_bucket');

class FillStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
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

    getPaintValueStopZoomLevels(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintValueStopZoomLevels('fill-color');
        } else {
            return super.getPaintValueStopZoomLevels(name);
        }
    }

    getPaintInterpolationT(name, globalProperties) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintInterpolationT('fill-color', globalProperties);
        } else {
            return super.getPaintInterpolationT(name, globalProperties);
        }
    }

    isPaintValueFeatureConstant(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.isPaintValueFeatureConstant('fill-color');
        } else {
            return super.isPaintValueFeatureConstant(name);
        }
    }

    isPaintValueZoomConstant(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.isPaintValueZoomConstant('fill-color');
        } else {
            return super.isPaintValueZoomConstant(name);
        }
    }

    createBucket(options) {
        return new FillBucket(options);
    }
}

module.exports = FillStyleLayer;
