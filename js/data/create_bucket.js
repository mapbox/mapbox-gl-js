'use strict';

module.exports = createBucket;

var LineBucket = require('./line_bucket');
var FillBucket = require('./fill_bucket');
var SymbolBucket = require('./symbol_bucket');
var CircleBucket = require('./circle_bucket');
var StyleDeclarationSet = require('../style/style_declaration_set');
var createCircleBucket = require('./circle_bucket2');

function createBucket(params) {
    var layer = params.layer;

    if (layer.type === 'circle') {
        return createCircleBucket(params);

    } else {

        var layoutDeclarations = new StyleDeclarationSet('layout', layer.type, layer.layout, {}).values();

        var BucketClass =
            layer.type === 'line' ? LineBucket :
            layer.type === 'fill' ? FillBucket :
            layer.type === 'symbol' ? SymbolBucket :
            layer.type === 'circle' ? CircleBucket : null;

        var bucket = new BucketClass(
            params.buffers,
            layoutDeclarations,
            params.overscaling,
            params.z,
            params.collisionDebug
        );

        bucket.id = layer.id;
        bucket.type = layer.type;
        bucket['source-layer'] = layer['source-layer'];
        bucket.interactive = layer.interactive;
        bucket.minZoom = layer.minzoom;
        bucket.maxZoom = layer.maxzoom;
        bucket.filter = params.filter;
        bucket.features = [];
        bucket.layerPaintDeclarations = {};
        bucket.devicePixelRatio = params.devicePixelRatio;
        bucket.layers = [];

        return bucket;
    }
}
