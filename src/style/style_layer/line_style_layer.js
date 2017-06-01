'use strict';

const StyleLayer = require('../style_layer');
const LineBucket = require('../../data/bucket/line_bucket');
const util = require('../../util/util');

class LineStyleLayer extends StyleLayer {
    createBucket(options) {
        return new LineBucket(options);
    }
}

module.exports = LineStyleLayer;
