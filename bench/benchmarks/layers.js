
const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');
const style = require('../data/empty.json');

class LayerBenchmark extends Benchmark {
    setup() {
        return createMap({
            zoom: 16,
            width: 1024,
            height: 768,
            center: [-77.032194, 38.912753],
            style: this.layerStyle
        }).then(map => {
            this.map = map;
        });
    }

    bench() {
        this.map._styleDirty = true;
        this.map._sourcesDirty = true;
        this.map._render();
    }

    teardown() {
        this.map.remove();
    }
}

class LayerBackground extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                id: 'backgroundlayer',
                type: 'background'
            }]
        });
    }
}

class LayerCircle extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                'id': 'circlelayer',
                'type': 'circle',
                'source': 'composite',
                'source-layer': 'poi_label'
            }]
        });
    }
}

class LayerFill extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                'id': 'filllayer',
                'type': 'fill',
                'source': 'composite',
                'source-layer': 'building',
                'paint': {
                    'fill-color': 'black',
                    'fill-outline-color': 'red'
                }
            }]
        });
    }
}

class LayerFillExtrusion extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                'id': 'fillextrusionlayer',
                'type': 'fill-extrusion',
                'source': 'composite',
                'source-layer': 'building',
                'paint': {
                    'fill-extrusion-height': 30
                }
            }]
        });
    }
}

class LayerHeatmap extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            sources: {
                'heatmap': {
                    'type': 'geojson',
                    'data': require('../data/naturalearth-land.json'),
                    'maxzoom': 23
                }
            },
            layers: [{
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
            }]
        });
    }
}

class LayerLine extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                'id': 'linelayer',
                'type': 'line',
                'source': 'composite',
                'source-layer': 'road'
            }]
        });
    }
}

class LayerRaster extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            sources: {
                'satellite': {
                    'url': 'mapbox://mapbox.satellite',
                    'type': 'raster',
                    'tileSize': 256
                }
            },
            layers: [{
                'id': 'rasterlayer',
                'type': 'raster',
                'source': 'satellite'
            }]
        });
    }
}

class LayerSymbol extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: [{
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'composite',
                'source-layer': 'poi_label',
                'layout': {
                    'icon-image': 'dot-11',
                    'text-field': '{name_en}'
                }
            }]
        });
    }
}


module.exports = [
    LayerBackground,
    LayerCircle,
    LayerFill,
    LayerFillExtrusion,
    LayerHeatmap,
    LayerLine,
    LayerRaster,
    LayerSymbol
];
