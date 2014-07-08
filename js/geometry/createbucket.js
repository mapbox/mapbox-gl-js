'use strict';

module.exports = createBucket;

var LineBucket = require('./linebucket.js');
var FillBucket = require('./fillbucket.js');
var SymbolBucket = require('./symbolbucket.js');
var RenderProperties = require('../style/renderproperties.js');

function createBucket(layer, collision, indices, buffers) {

    if (!RenderProperties[layer.type]) {
        //console.warn('unknown bucket type');
        return;
    }

    var info = new RenderProperties[layer.type](layer.render);

    if (layer.type === 'line') {
        return new LineBucket(info, buffers, collision, indices);
    } else if (layer.type === 'fill') {
        return new FillBucket(info, buffers, collision, indices);
    } else if (layer.type === 'symbol') {
        return new SymbolBucket(info, buffers, collision, indices);
    } else {
        //console.warn('unknown bucket type');
    }
}
