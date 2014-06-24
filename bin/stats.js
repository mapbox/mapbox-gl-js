#!/usr/bin/env node
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var VectorTileFeature = require('vector-tile').VectorTileFeature;


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

    var omit = ['osm_id', 'name', 'name_en', 'name_de', 'name_es', 'name_fr', 'maki', 'website', 'address', 'reflen', 'len', 'area'];

    var stats = { fill: {}, line: {}, point: {} };
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];
        var tags = {};
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            var type = VectorTileFeature.mapping[feature._type];
            if (!(type in tags)) tags[type] = stats[type][layer_name] = { '(all)': 0 };
            tags[type]['(all)']++;
            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_' && omit.indexOf(key) < 0) {
                    if (!(key in tags[type])) tags[type][key] = {};
                    var val = feature[key];
                    if (tags[type][key][val]) tags[type][key][val]++;
                    else tags[type][key][val] = 1;
                }
            }
        }
    }

    console.warn(JSON.stringify(stats.fill.water, null, 4));
});
