'use strict';

const StyleLayer = require('../style_layer');
const CircleBucket = require('../../data/bucket/circle_bucket');

class CircleStyleLayer extends StyleLayer {
    createBucket(options) {
        return new CircleBucket(options);
    }
}

module.exports = CircleStyleLayer;
