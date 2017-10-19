// @flow

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');
const style = require('../data/empty.json');

module.exports = class LayerRaster extends Benchmark {
    setup() {
        this.style = Object.assign({}, style);
        this.style.sources = {
            'satellite': {
                'url': 'mapbox://mapbox.satellite',
                'type': 'raster',
                'tileSize': 256
            }
        };
        this.style.layers.push({
            'id': 'layer',
            'type': 'raster',
            'source': 'satellite'
        });
    }

    bench() {
        return createMap({
            zoom: 16,
            width: 1024,
            height: 768,
            center: [-77.032194, 38.912753],
            style: this.style
        }).then(map => map.remove());
    }
};
