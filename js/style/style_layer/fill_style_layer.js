'use strict';

const StyleLayer = require('../style_layer');
const FillBucket = require('../../data/bucket/fill_bucket');

class FillStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
        if (name === 'fill-outline-color') {
            // Special-case handling when transitioning either to or from an
            // undefined fill-outline-color values
            const toValue = this.getPaintProperty('fill-outline-color');
            if (toValue === undefined) {
                return super.getPaintValue('fill-color', globalProperties, featureProperties);
            }

            // https://github.com/mapbox/mapbox-gl-js/issues/3657
            const transition = this._paintTransitions['fill-outline-color'];
            if (transition && !transition.instant()) {
                const fromValue = transition.oldTransition._calculateTargetValue(globalProperties, featureProperties);
                if (!fromValue) {
                    return super.getPaintValue('fill-color', globalProperties, featureProperties);
                }
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
