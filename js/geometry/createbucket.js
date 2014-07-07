'use strict';

module.exports = createBucket;

var LineBucket = require('./linebucket.js');
var FillBucket = require('./fillbucket.js');
var SymbolBucket = require('./symbolbucket.js');
var RenderProperties = require('../style/renderproperties.js');

function createBucket(info, collision, indices, buffers) {

    if (!RenderProperties[info.type]) {
        //console.warn('unknown bucket type');
        return;
    }

    info = new RenderProperties[info.type](info);

    if (info.type === 'line') {
        return new LineBucket(info, buffers, collision, indices);
    } else if (info.type === 'fill') {
        return new FillBucket(info, buffers, collision, indices);
    } else if (info.type === 'symbol') {
        return new SymbolBucket(info, buffers, collision, indices);
    } else {
        //console.warn('unknown bucket type');
    }
}
