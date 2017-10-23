
const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');
const style = require('../data/empty.json');

module.exports = class LayerFill extends Benchmark {
    setup() {
        this.style = Object.assign({}, style);
        this.style.layers = [{
            'id': 'filllayer',
            'type': 'fill',
            'source': 'composite',
            'source-layer': 'building',
            'paint': {
                'fill-color': 'black',
                'fill-outline-color': 'red'
            }
        }];
    }

    bench() {
        return createMap({
            zoom: 16,
            width: 1024,
            height: 768,
            center: [-77.032194, 38.912753],
            style: this.style
        }).then(map => map.remove())
            .catch(error => {
                console.error(error);
            });
    }
};
