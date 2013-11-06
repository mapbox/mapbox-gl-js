#!/usr/bin/env node
var Protobuf = require('../js/protobuf.js');
var VectorTile = require('../js/vectortile.js');


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
    
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];

        console.warn("\x1B[32m\x1B[1m%s\x1B[22m\x1B[39m", layer_name);

        var tags = {};

        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);

            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_') {
                    if (!(key in tags)) tags[key] = [];
                    tags[key].push(feature[key]);
                }
            }
        }

        for (var key in tags) {
            var counts = {};
            for (var i = 0; i < tags[key].length; i++) {
                var val = tags[key][i];
                if (counts[val]) counts[val].count++;
                else counts[val] = { val: val, count: 1 };
            }

            counts = Object.keys(counts).map(function(k) { return counts[k]; });
            counts.sort(function(a, b) {
                return b.count - a.count;
            });
            counts = counts.map(function(c) {
                return JSON.stringify(c.val) + ": " + c.count;
            }).join(", ");

            var width = process.stdout.columns - 4 - key.length - 2;
            if (counts.length > width) {
                counts = counts.substr(0, width - 3) + '...';
            }


            console.warn('    %s: \x1B[90m%s\x1B[39m', key, counts);
        }
    }

});