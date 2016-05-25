#!/usr/bin/env node

var earcut = require('earcut');
var VectorTile = require('vector-tile').VectorTile;
var Protobuf = require('pbf');
var request = require('request');
var FillBucket = require('../js/data/bucket/fill_bucket');
var StyleLayer = require('../js/style/style_layer');

var API_URL = process.env.API_URL || 'https://api.mapbox.com/v4/';

function benchmark_earcut(opts, callback) {
    var url = opts.source.replace(/^mapbox:\/\//, API_URL);
    url += '/' + opts.z + '/' + opts.x + '/' + opts.y + '.vector.pbf';
    url += '?access_token=' + process.env.MAPBOX_ACCESS_TOKEN;

    var RUN_COUNT = opts.count;

    request(url, {encoding:null, gzip:true}, function(err, response) {
        if (err) return callback(err);
        if (response.statusCode !== 200) return callback(new Error('Tile request returned with status code: ' + response.statusCode));
        var diffs = [];

        var tile = new VectorTile(new Protobuf(response.body));
        if (!tile.layers[opts.layer]) return callback(new Error('Layer not found in tile'));

        var targetLayer = tile.layers[opts.layer];
        for (var i = 0; i < targetLayer.length; i++) {
            var feature = targetLayer.feature(i);
            var flattened = earcut.flatten(classifyRings(feature.loadGeometry()));
            var styleLayers = new Array(RUN_COUNT),
                buckets = new Array(RUN_COUNT);

            var totalDiff = 0,
                minDiff = 10000000000,
                maxDiff = 0;
            for (var j = 0; j < RUN_COUNT; j++) {
                styleLayers[j] = new StyleLayer({ id: 'test', type: 'fill', layout: {} });
                buckets[j] = new FillBucket({
                    buffers: {},
                    layer: styleLayers[j],
                    childLayers: [styleLayers[j]]
                });
                buckets[j].createArrays();

                var start = Date.now();
                buckets[j].addFeature(feature);
                var diff = Date.now() - start;
                totalDiff += diff;
                minDiff = diff < minDiff ? diff : minDiff;
                maxDiff = diff > maxDiff ? diff : maxDiff;
            }

            diffs.push({
                vertices: flattened.vertices.length,
                holes: flattened.holes.length,
                avg_ms_bucket_addFeature: totalDiff/RUN_COUNT,
                min_ms_bucket_addFeature: minDiff,
                max_ms_bucket_addFeature: maxDiff
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
    var argv = require('minimist')(process.argv.slice(2), {
        alias: {
            n: 'count'
        }
    });

    if (argv._.length !== 5) {
        console.log('Description:');
        console.log('  Performs a triangulation benchmark on a production tileset');
        console.log('Usage:');
        console.log('  ./bench/earcut-a-tilesource.js <tileset-id> <source-layer> <zoom> <x> <y>');
        console.log('Options:');
        console.log('  --count=[number]       Number of iterations to run the benchmark (default 1) (alias -n)');
        console.log('Example:');
        console.log('  ./bench/earcut-a-tilesource.js mapbox://mapbox.mapbox-streets-v7 water 0 0 0 -n 10');
        process.exit(1);
    }

    var source = argv._[0],
        layer = argv._[1],
        count = argv.count || 1,
        z = argv._[2],
        x = argv._[3],
        y = argv._[4];

    benchmark_earcut({
        source: source,
        layer: layer,
        count: count,
        z: z,
        x: x,
        y: y
    }, function(err, speeds) {
        if (err) throw err;

        console.log(speeds);
    });
}
