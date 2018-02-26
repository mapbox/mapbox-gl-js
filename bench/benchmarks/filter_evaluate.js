
import Benchmark from '../lib/benchmark';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import createFilter from '../../src/style-spec/feature_filter';
import filters from '../data/filters.json';
import assert from 'assert';

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
