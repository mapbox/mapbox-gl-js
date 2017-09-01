'use strict';

const VectorTile = require('@mapbox/vector-tile').VectorTile;
const Pbf = require('pbf');
const Evented = require('../../src/util/evented');
const createFilter = require('../../src/style-spec/feature_filter');
const formatNumber = require('../lib/format_number');
const ajax = require('../../src/util/ajax');
const filters = require('../data/filters.json');

const NRepeat = 100;

module.exports = function () {
    const evented = new Evented();

    ajax.getArrayBuffer({url: 'data/785.vector.pbf'}, (err, response) => {
        if (err) {
            return evented.fire('error', err);
        }
        const assets = {
            tile: new VectorTile(new Pbf(response.data))
        };
        run(evented, assets);
    });

    return evented;
};

function run (evented, assets) {
    const tile = assets.tile;
    const results = [['task', 'iteration', 'time']];
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

    let start = performance.now();
    let created = 0;
    for (let m = 0; m < NRepeat; m++) {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            layer.filters = [];
            for (let j = 0; j < layer.rawFilters.length; j++) {
                layer.filters.push(createFilter(layer.rawFilters[j]));
                results.push(['create', ++created, performance.now() - start]);
            }
        }
    }

    evented.fire('log', {message: `Create filter: ${formatNumber(performance.now() - start)}ms (${created} iterations)`});

    start = performance.now();
    let applied = 0;
    for (let m = 0; m < NRepeat; m++) {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            for (let j = 0; j < layer.filters.length; j++) {
                const filter = layer.filters[j];
                for (let k = 0; k < layer.features.length; k++) {
                    const feature = layer.features[k];
                    if (typeof filter(feature) !== 'boolean') {
                        evented.fire('error', {message: 'Expected boolean result from filter'});
                        break;
                    }
                    ++applied;
                }
                results.push(['apply', applied, performance.now() - start]);
            }
        }
    }

    evented.fire('log', {message: `Apply filter: ${formatNumber(performance.now() - start)}ms (${applied} iterations)`});

    evented.fire('end', {message: 'Done', samples: results});
}
