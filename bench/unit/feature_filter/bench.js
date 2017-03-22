'use strict';

const VectorTile = require('vector-tile').VectorTile;
const Pbf = require('pbf');
const fs = require('fs');
const createFilter = require('../../../src/style-spec').featureFilter;
const filters = require('./filters.json');
const path = require('path');

const tile = new VectorTile(new Pbf(fs.readFileSync(path.join(__dirname, './785.vector.pbf'))));

const layers = [];
for (const name in tile.layers) {
    const layer = tile.layers[name];
    if (!layer.length) continue;

    const features = [];
    for (let j = 0; j < layer.length; j++) {
        features.push(layer.feature(j));
    }

    const layerFilters = [];
    for (let j = 0; j < filters.length; j++) {
        if (filters[j].layer === name) layerFilters.push(filters[j].filter);
    }

    layers.push({
        name: name,
        features: features,
        rawFilters: layerFilters
    });
}

console.time('create filters');
for (let m = 0; m < 100; m++) {
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        layer.filters = [];
        for (let j = 0; j < layer.rawFilters.length; j++) {
            layer.filters.push(createFilter(layer.rawFilters[j]));
        }
    }
}
console.timeEnd('create filters');

console.time('apply filters');
for (let m = 0; m < 100; m++) {
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        for (let j = 0; j < layer.features.length; j++) {
            const feature = layer.features[j];
            for (let k = 0; k < layer.filters.length; k++) {
                const filter = layer.filters[k];
                filter(feature);
            }
        }
    }
}
console.timeEnd('apply filters');
