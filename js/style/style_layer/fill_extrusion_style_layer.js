'use strict';

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');

class FillExtrusionStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
        const value = super.getPaintValue(name, globalProperties, featureProperties);
        if (name === 'fill-extrusion-color') {
            value[3] = 1;
        }
        return value;
    }

    createBucket(options) {
        return new FillExtrusionBucket(options);
    }
}

module.exports = FillExtrusionStyleLayer;
