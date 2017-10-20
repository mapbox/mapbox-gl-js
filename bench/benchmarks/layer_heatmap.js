
const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');
const style = require('../data/empty.json');
const geojson = require('../data/naturalearth-land.json');

module.exports = class LayerHeatmap extends Benchmark {
    setup() {
        this.style = Object.assign({}, style);
        this.style.sources = {
            'heatmap': {
                'type': 'geojson',
                'data': geojson,
                'maxzoom': 23
            }
        };
        this.style.layers.push({
            'id': 'layer',
            'type': 'heatmap',
            'source': 'heatmap',
            'paint': {
                "heatmap-radius": 50,
                "heatmap-weight": {
                    "stops": [[0, 0.5], [4, 2]]
                },
                "heatmap-intensity": 0.9,
                "heatmap-color": [
                    "curve",
                    ["linear"],
                    ["heatmap-density"],
                    0, "rgba(0, 0, 255, 0)",
                    0.1, "royalblue",
                    0.3, "cyan",
                    0.5, "lime",
                    0.7, "yellow",
                    1, "red"
                ]
            }
        });
    }

    bench() {
        return createMap({
            zoom: 8,
            width: 1024,
            height: 768,
            center: [-76.216, 38.67],
            style: this.style
        }).then(map => map.remove());
    }
};
