'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var CircleBucket = require('./circle_bucket');
var LayoutProperties = require('../style/layout_properties');
var featureFilter = require('feature-filter');
var StyleDeclarationSet = require('../style/style_declaration_set');

function createBucket(layer, buffers, z, overscaling, collisionDebug) {
    var values = new StyleDeclarationSet('layout', layer.type, layer.layout, {}).values(),
        fakeZoomHistory = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 },
        layout = {};

    for (var k in values) {
        layout[k] = values[k].calculate(z, fakeZoomHistory);
    }

    if (layer.type === 'symbol') {
        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        if (values['text-size']) {
            layout['text-max-size'] = values['text-size'].calculate(18, fakeZoomHistory);
            layout['text-size'] = values['text-size'].calculate(z + 1, fakeZoomHistory);
        }
        if (values['icon-size']) {
            layout['icon-max-size'] = values['icon-size'].calculate(18, fakeZoomHistory);
            layout['icon-size'] = values['icon-size'].calculate(z + 1, fakeZoomHistory);
        }
    }

    var BucketClass =
        layer.type === 'line' ? LineBucket :
        layer.type === 'fill' ? FillBucket :
        layer.type === 'symbol' ? SymbolBucket :
        layer.type === 'circle' ? CircleBucket : null;

    var bucket = new BucketClass(buffers, new LayoutProperties[layer.type](layout), overscaling, z, collisionDebug);

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
