'use strict';

const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
const StyleLayer = require('../../src/style/style_layer');
const deref = require('../../src/style-spec/deref');

module.exports = class StyleLayerCreate extends Benchmark {
    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => { this.json = json; });
    }

    bench() {
        for (const layer of deref(this.json.layers)) {
            StyleLayer.create(layer);
        }
    }
};
