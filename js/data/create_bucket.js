'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var LayoutProperties = require('../style/layout_properties');
var featureFilter = require('feature-filter');

function createBucket(layer, buffers, collision, indices) {

    if (!LayoutProperties[layer.type]) {
        //console.warn('unknown bucket type');
        return;
    }

    var layoutProperties = new LayoutProperties[layer.type](layer.layout);

    var BucketClass =
        layer.type === 'line' ? LineBucket :
        layer.type === 'fill' ? FillBucket :
        layer.type === 'symbol' ? SymbolBucket : null;

    var bucket = new BucketClass(layoutProperties, buffers, collision, indices);

    bucket.id = layer.id;
    bucket.type = layer.type;
    bucket['source-layer'] = layer['source-layer'];
    bucket.interactive = layer.interactive;
    bucket.minZoom = layer.minzoom;
    bucket.maxZoom = layer.maxzoom;
    bucket.filter = featureFilter(layer.filter);
    bucket.features = [];

    return bucket;
}
