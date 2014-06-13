'use strict';

module.exports = createBucket;

var Bucket = require('./bucket.js');
var LineBucket = require('./linebucket.js');

function createBucket(info, geometry, placement, indices, buffers) {
    if (info.line) {
        return new LineBucket(info, buffers, placement, indices);
    } else {
        return new Bucket(info, geometry, placement, indices);
    }
}
