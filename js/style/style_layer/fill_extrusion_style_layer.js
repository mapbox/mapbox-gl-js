'use strict';

const StyleLayer = require('../style_layer');
const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');

class FillExtrusionStyleLayer extends StyleLayer {
    createBucket(options) {
        return new FillExtrusionBucket(options);
    }
}

module.exports = FillExtrusionStyleLayer;
