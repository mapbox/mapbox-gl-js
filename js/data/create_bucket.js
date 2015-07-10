'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var CircleBucket = require('./circle_bucket');
var featureFilter = require('feature-filter');
var StyleDeclarationSet = require('../style/style_declaration_set');
var createCircleBucket = require('./circle_bucket2');

function createBucket(params) {
    var layer = params.layer;
    var filter = featureFilter(layer.filter);

    if (layer.type === 'circle') {
        return createCircleBucket(params);

    } else {

        var buffers = params.buffers;
        var z = params.z;
        var overscaling = params.overscaling;
        var collisionDebug = params.collisionDebug;
        var devicePixelRatio = params.devicePixelRatio;

        var layoutDeclarations = new StyleDeclarationSet('layout', layer.type, layer.layout, {}).values();

        var BucketClass =
            layer.type === 'line' ? LineBucket :
            layer.type === 'fill' ? FillBucket :
            layer.type === 'symbol' ? SymbolBucket :
            layer.type === 'circle' ? CircleBucket : null;

        var bucket = new BucketClass(buffers, layoutDeclarations, overscaling, z, collisionDebug);

        bucket.id = layer.id;
        bucket.type = layer.type;
        bucket['source-layer'] = layer['source-layer'];
        bucket.interactive = layer.interactive;
        bucket.minZoom = layer.minzoom;
        bucket.maxZoom = layer.maxzoom;
        bucket.filter = filter;
        bucket.features = [];
        bucket.layerPaintDeclarations = {};
        bucket.devicePixelRatio = devicePixelRatio;

        return bucket;
    }
}
