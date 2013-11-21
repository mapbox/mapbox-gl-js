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
    

    var stats = {};
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];
        var tags = stats[layer_name] = {};
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            for (var key_name in feature) {
                if (['osm_id', 'name', 'name_en', 'name_de', 'name_es', 'name_fr', 'maki', 'website', 'address', 'reflen', 'len', 'area'].indexOf(key_name) >= 0) continue;
                if (feature.hasOwnProperty(key_name) && key_name[0] !== '_') {
                    if (!(key_name in tags)) tags[key_name] = {};
                    var val = feature[key_name];
                    if (tags[key_name][val]) tags[key_name][val]++;
                    else tags[key_name][val] = 1;
                }
            }
        }
    }

    console.warn(stats.road);

});