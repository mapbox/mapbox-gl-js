// @flow

import Benchmark from '../lib/benchmark';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import createFilter from '../../src/style-spec/feature_filter';
import {normalizeStyleURL} from '../../src/util/mapbox';
import assert from 'assert';

export default class FilterEvaluate extends Benchmark {
    constructor(style: string) {
        super();
        this.styleURL = normalizeStyleURL(style);
    }

    setup() {
        return fetch(this.styleURL)
        .then(response => response.json())
        .then(data => {
            this.style = data;
            this.filters = this.style.layers.filter(l => l.filter && l['source-layer']).map(l => {
                return {layer: l['source-layer'], filter: l.filter}
            });
            return fetch('/bench/data/785.vector.pbf')
        })
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
                for (const filter of this.filters) {
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
}
