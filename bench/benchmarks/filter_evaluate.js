
const Benchmark = require('../lib/benchmark');
const VectorTile = require('@mapbox/vector-tile').VectorTile;
const Pbf = require('pbf');
const createFilter = require('../../src/style-spec/feature_filter');
const filters = require('../data/filters.json');
const assert = require('assert');

module.exports = class FilterEvaluate extends Benchmark {
    setup() {
        return fetch('/bench/data/785.vector.pbf')
            .then(response => response.arrayBuffer())
            .then(data => {
                const tile = new VectorTile(new Pbf(data));

                this.layers = [];
                for (const name in tile.layers) {
                    const layer = tile.layers[name];
                    if (!layer.length) continue;

                    const features = [];
                    for (let j = 0; j < layer.length; j++) {
                        features.push(layer.feature(j));
                    }

                    const layerFilters = [];
                    for (const filter of filters) {
                        if (filter.layer === name) {
                            layerFilters.push(createFilter(filter.filter));
                        }
                    }

                    this.layers.push({ features, filters: layerFilters });
                }
            });
    }

    bench() {
        for (const layer of this.layers) {
            for (const filter of layer.filters) {
                for (const feature of layer.features) {
                    if (typeof filter({zoom: 0}, feature) !== 'boolean') {
                        assert(false, 'Expected boolean result from filter');
                    }
                }
            }
        }
    }
};
