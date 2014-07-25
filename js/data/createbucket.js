'use strict';

module.exports = createBucket;

var LineBucket = require('./linebucket.js');
var FillBucket = require('./fillbucket.js');
var SymbolBucket = require('./symbolbucket.js');
var RasterBucket = require('./rasterbucket.js');
var RenderProperties = require('../style/renderproperties.js');

function createBucket(layer, buffers, collision, indices) {

    if (!RenderProperties[layer.type]) {
        //console.warn('unknown bucket type');
        return;
    }

    var info = new RenderProperties[layer.type](layer.render);

    var BucketClass =
        layer.type === 'line' ? LineBucket :
        layer.type === 'fill' ? FillBucket :
        layer.type === 'symbol' ? SymbolBucket :
        layer.type === 'raster' ? RasterBucket : null;

    var bucket = new BucketClass(info, buffers, collision, indices);
    bucket.type = layer.type;
    bucket.interactive = layer.interactive;
    bucket.minZoom = layer['min-zoom'];
    bucket.maxZoom = layer['max-zoom'];

    return bucket;
}
