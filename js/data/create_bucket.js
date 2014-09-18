'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var RasterBucket = require('./raster_bucket');
var RenderProperties = require('../style/render_properties');

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
