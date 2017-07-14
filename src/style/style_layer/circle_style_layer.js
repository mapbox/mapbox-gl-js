// @flow

const StyleLayer = require('../style_layer');
const CircleBucket = require('../../data/bucket/circle_bucket');

import type {BucketParameters} from '../../data/bucket';

class CircleStyleLayer extends StyleLayer {
    createBucket(parameters: BucketParameters) {
        return new CircleBucket(parameters);
    }
}

module.exports = CircleStyleLayer;
