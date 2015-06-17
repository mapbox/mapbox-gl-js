'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var featureFilter = require('feature-filter');
var StyleDeclarationSet = require('../style/style_declaration_set');

function createBucket(layer, buffers, constants, z, overscaling, collisionDebug) {
    var layoutDeclarations = new StyleDeclarationSet('layout', layer.type, layer.layout, {}).values();
    var paintDeclarations = new StyleDeclarationSet('paint', layer.type, layer.paint, constants).values();

    var BucketClass =
        layer.type === 'line' ? LineBucket :
        layer.type === 'fill' ? FillBucket :
        layer.type === 'symbol' ? SymbolBucket : null;

    var bucket = new BucketClass(buffers, layoutDeclarations, paintDeclarations, overscaling, z, collisionDebug);

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
