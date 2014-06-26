'use strict';

module.exports = createBucket;

var LineBucket = require('./linebucket.js');
var FillBucket = require('./fillbucket.js');
var TextBucket = require('./textbucket.js');

function createBucket(info, collision, indices, buffers) {
    if (info.type === 'line') {
        return new LineBucket(info, buffers, collision, indices);
    } else if (info.type === 'fill') {
        return new FillBucket(info, buffers, collision, indices);
    } else if (info.type === 'symbol') {
        return new TextBucket(info, buffers, collision, indices);
    } else {
        //console.warn('unknown bucket type');
    }
}
