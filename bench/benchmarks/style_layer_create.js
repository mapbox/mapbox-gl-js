
const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
const StyleLayer = require('../../src/style/style_layer');
const deref = require('../../src/style-spec/deref');

module.exports = class StyleLayerCreate extends Benchmark {
    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => { this.layers = deref(json.layers); });
    }

    bench() {
        for (const layer of this.layers) {
            StyleLayer.create(layer);
        }
    }
};
