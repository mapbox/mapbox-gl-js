#!/usr/bin/env node
var assert = require('assert');
var Protobuf = require('pbf');
var vt = require('vector-tile'),
    VectorTile = vt.VectorTile,
    VectorTileFeature = vt.VectorTileFeature;
var rbush = require('../js/lib/rbush.js');


// Script for displaying tags/frequency in a vector tile

var fs = require("fs");
var zlib = require("zlib");

if (process.argv.length < 3) {
    console.warn('Usage: %s %s [file.vector.pbf]', process.argv[0], process.argv[1]);
    process.exit(1);
}

var data = fs.readFileSync(process.argv[2]);

zlib.inflate(data, function(err, data) {
if (err) throw err;

var tile = new VectorTile(new Protobuf(new Uint8Array(data)));


var tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);

for (var layer_name in tile.layers) {
    var layer = tile.layers[layer_name];
    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);

        var bbox = feature.bbox();
        bbox.index = i;
        bbox.layer = layer_name;
        tree.insert(bbox);

        assert(bbox.x1 <= bbox.x2);
        assert(bbox.y1 <= bbox.y2);
    }
}

var radius = 16;
var x = 126 * 16;
var y =  72 * 16;
var result = tree.search([ x - radius, y - radius, x + radius, y + radius ]);

for (var i = 0; i < result.length; i++) {
    var layer = tile.layers[result[i].layer];
    var feature = layer.feature(result[i].index);

    console.warn(result[i].layer, feature._type, feature['class'], feature.contains({ x: x, y: y }, radius));
}



});
