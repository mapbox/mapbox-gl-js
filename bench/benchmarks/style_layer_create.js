
import Benchmark from '../lib/benchmark';
import accessToken from '../lib/access_token';
import StyleLayer from '../../src/style/style_layer';
import deref from '../../src/style-spec/deref';

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
