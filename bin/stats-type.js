#!/usr/bin/env node
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;


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

    var stats = {};
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];
        var types = stats[layer_name] = { fill: 0, line: 0, point: 0, other: 0 };
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            switch (feature._type) {
                case 1: types.point++; break;
                case 2: types.line++; break;
                case 3: types.fill++; break;
                default: types.other++; break;
            }
        }
        console.warn(layer_name, types);
    }

    console.warn(stats.road);

});
