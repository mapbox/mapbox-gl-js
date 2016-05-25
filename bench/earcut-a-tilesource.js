#!/usr/bin/env node

var earcut = require('earcut');
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var request = require('request');
var FillBucket = require('../js/data/bucket/fill_bucket');
var StyleLayer = require('../js/style/style_layer');

var API_URL = process.env.API_URL || 'https://api.mapbox.com/v4/';

function benchmark_earcut(source, layer, z, x, y, callback) {
    var url = source.replace(/^mapbox:\/\//, API_URL);
    url += '/' + z + '/' + x + '/' + y + '.vector.pbf';
    url += '?' + process.env.MAPBOX_ACCESS_TOKEN;

    request(url, {encoding:null, gzip:true}, function(err, response) {
        if (err || response.statusCode !== 200) return callback(err);
        var diffs = [];

        var tile = new VectorTile(new Protobuf(response.body));
        if (!tile.layers[layer]) return callback(new Error('Layer not found in tile'));

        var targetLayer = tile.layers[layer];
        for (var i = 0; i < targetLayer.length; i++) {
            var feature = targetLayer.feature(i);

            var styleLayer = new StyleLayer({ id: 'test', type: 'fill', layout: {} });
            var bucket = new FillBucket({
                buffers: {},
                layer: styleLayer,
                childLayers: [styleLayer]
            });
            bucket.createArrays();

            var flattened = earcut.flatten(classifyRings(feature.loadGeometry()));
            /*
            var result;
            var start1 = Date.now();
            for (var j = 0; j < 1000; j++) {
                result = earcut(flattened.vertices, flattened.holes, flattened.dimensions);
            }
            var diff1 = Date.now() - start1;
            */

            var start2 = Date.now();
            for (var k = 0; k < 100; k++) {
                bucket.addFeature(feature);
            }
            var diff2 = Date.now() - start2;

            diffs.push({
                vertices: flattened.vertices.length,
                holes: flattened.holes.length,
                /*
                triangles: result.length / 3,
                avg_ms_earcut: diff1/1000,
                */
                avg_ms_bucket_addFeature: diff2/100
            });
        }
        return callback(null, diffs);
    });
}

'use strict';

module.exports = classifyRings;

// classifies an array of rings into polygons with outer rings and holes

function classifyRings(rings) {
    var len = rings.length;

    if (len <= 1) return [rings];

    var polygons = [],
        polygon,
        ccw;

    for (var i = 0; i < len; i++) {
        var area = signedArea(rings[i]);
        if (area === 0) continue;

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else {
            polygon.push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    return polygons;
}

function signedArea(ring) {
    var sum = 0;
    for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

module.exports = benchmark_earcut;

if (require.main) {
    var argv = require('minimist')(process.argv.slice(2));

    if (argv._.length !== 5) {
        console.log('Description:');
        console.log('  Performs a triangulation benchmark on a production tileset');
        console.log('Usage:');
        console.log('  ./bench/earcut-a-tilesource.js <tileset-id> <source-layer> <zoom> <x> <y>');
        console.log('Example:');
        console.log('  ./bench/earcut-a-tilesource.js mapbox://mapbox.mapbox-streets-v7 water 0 0 0');
        process.exit(1);
    }

    var source = argv._[0],
        layer = argv._[1],
        zoom = argv._[2],
        x = argv._[3],
        y = argv._[4];

    benchmark_earcut(source, layer, zoom, x, y, function(err, speeds) {
        if (err) throw err;

        console.log(speeds);
    });
}
