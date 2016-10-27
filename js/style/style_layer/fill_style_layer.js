'use strict';

const StyleLayer = require('../style_layer');
const FillBucket = require('../../data/bucket/fill_bucket');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');

class FillStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintValue('fill-color', globalProperties, featureProperties);
        } else {
            return super.getPaintValue(name, globalProperties, featureProperties);
        }
    }

    getPaintValueStopZoomLevels(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintValueStopZoomLevels('fill-color');
        } else {
            return super.getPaintValueStopZoomLevels(name);
        }
    }

    getPaintInterpolationT(name, zoom) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return super.getPaintInterpolationT('fill-color', zoom);
        } else {
            return super.getPaintInterpolationT(name, zoom);
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

    isExtruded(globalProperties) {
        return !this.isPaintValueFeatureConstant('fill-extrude-height') ||
            !this.isPaintValueZoomConstant('fill-extrude-height') ||
            this.getPaintValue('fill-extrude-height', globalProperties) !== 0;
    }

    createBucket(options) {
        if (this.isExtruded({zoom: options.zoom})) {
            return new FillExtrusionBucket(options);
        }
        return new FillBucket(options);
    }
}

module.exports = FillStyleLayer;
