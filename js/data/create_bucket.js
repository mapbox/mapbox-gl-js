'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var LayoutProperties = require('../style/layout_properties');
var featureFilter = require('feature-filter');
var StyleDeclaration = require('../style/style_declaration');
var util = require('../util/util');

function createBucket(layer, buffers, collision, z) {

    if (!LayoutProperties[layer.type]) {
        //console.warn('unknown bucket type');
        return null;
    }

    var calculatedLayout = util.extend({}, layer.layout);
    for (var k in calculatedLayout) {
        calculatedLayout[k] = new StyleDeclaration('layout', layer.type, k, calculatedLayout[k]).calculate(z);
    }

    var layoutProperties = new LayoutProperties[layer.type](calculatedLayout);
    layoutProperties.zoom = z;

    var BucketClass =
        layer.type === 'line' ? LineBucket :
        layer.type === 'fill' ? FillBucket :
        layer.type === 'symbol' ? SymbolBucket : null;

    var bucket = new BucketClass(buffers, layoutProperties, collision);

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
