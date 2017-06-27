// @flow

const StyleLayer = require('../style_layer');
const LineBucket = require('../../data/bucket/line_bucket');

import type {BucketParameters} from '../../data/bucket';

class LineStyleLayer extends StyleLayer {
    createBucket(parameters: BucketParameters) {
        return new LineBucket(parameters);
    }
}

module.exports = LineStyleLayer;
