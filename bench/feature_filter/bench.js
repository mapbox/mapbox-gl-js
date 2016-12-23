'use strict';

var VectorTile = require('vector-tile').VectorTile;
var Pbf = require('pbf');
var fs = require('fs');
var createFilter = require('../../').featureFilter;
var filters = require('./filters.json');
var path = require('path');

var tile = new VectorTile(new Pbf(fs.readFileSync(path.join(__dirname, './785.vector.pbf'))));

var layers = [];
for (var name in tile.layers) {
    var layer = tile.layers[name];
    if (!layer.length) continue;

    var features = [];
    for (var j = 0; j < layer.length; j++) {
        features.push(layer.feature(j));
    }

    var layerFilters = [];
    for (j = 0; j < filters.length; j++) {
        if (filters[j].layer === name) layerFilters.push(filters[j].filter);
    }

    layers.push({
        name: name,
        features: features,
        rawFilters: layerFilters
    });
}

console.time('create filters');
for (var m = 0; m < 100; m++) {
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        layer.filters = [];
        for (j = 0; j < layer.rawFilters.length; j++) {
            layer.filters.push(createFilter(layer.rawFilters[j]));
        }
    }
}
console.timeEnd('create filters');

console.time('apply filters');
for (var m = 0; m < 100; m++) {
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        for (j = 0; j < layer.features.length; j++) {
            var feature = layer.features[j];
            for (var k = 0; k < layer.filters.length; k++) {
                var filter = layer.filters[k];
                filter(feature);
            }
        }
    }
}
console.timeEnd('apply filters');
