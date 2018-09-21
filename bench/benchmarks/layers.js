
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import style from '../data/empty.json';

const width = 1024;
const height = 768;

function generateLayers(layer) {
    const generated = [];
    for (let i = 0; i < 50; i++) {
        const id = layer.id + i;
        generated.push(Object.assign({}, layer, {id: id}));
    }
    return generated;
}

class LayerBenchmark extends Benchmark {
    setup() {
        return createMap({
            zoom: 16,
            width,
            height,
            center: [-77.032194, 38.912753],
            style: this.layerStyle
        }).then(map => {
            this.map = map;
        });
    }

    bench() {
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
            layers: generateLayers({
                id: 'backgroundlayer',
                type: 'background'
            })
        });
    }
}

class LayerCircle extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'circlelayer',
                'type': 'circle',
                'source': 'composite',
                'source-layer': 'poi_label'
            })
        });
    }
}

class LayerFill extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'filllayer',
                'type': 'fill',
                'source': 'composite',
                'source-layer': 'building',
                'paint': {
                    'fill-color': 'black',
                    'fill-outline-color': 'red'
                }
            })
        });
    }
}

class LayerFillExtrusion extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'fillextrusionlayer',
                'type': 'fill-extrusion',
                'source': 'composite',
                'source-layer': 'building',
                'paint': {
                    'fill-extrusion-height': 30
                }
            })
        });
    }
}

class LayerHeatmap extends LayerBenchmark {
    setup() {
        return fetch('/bench/data/naturalearth-land.json')
            .then(response => response.json())
            .then(data => {
                this.layerStyle = Object.assign({}, style, {
                    sources: {
                        'heatmap': {
                            'type': 'geojson',
                            'data': data,
                            'maxzoom': 23
                        }
                    },
                    layers: generateLayers({
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
                                "interpolate",
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
                    })
                });
            })
            .then(() => super.setup());
    }
}

class LayerHillshade extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            sources: {
                'terrain-rgb': {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.terrain-rgb'
                }
            },
            layers: generateLayers({
                'id': 'layer',
                'type': 'hillshade',
                'source': 'terrain-rgb',
            })
        });
    }
}

class LayerLine extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'linelayer',
                'type': 'line',
                'source': 'composite',
                'source-layer': 'road'
            })
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
            layers: generateLayers({
                'id': 'rasterlayer',
                'type': 'raster',
                'source': 'satellite'
            })
        });
    }
}

class LayerSymbol extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'composite',
                'source-layer': 'poi_label',
                'layout': {
                    'icon-image': 'dot-11',
                    'text-field': '{name_en}'
                }
            })
        });
    }
}


export default [
    LayerBackground,
    LayerCircle,
    LayerFill,
    LayerFillExtrusion,
    LayerHeatmap,
    LayerHillshade,
    LayerLine,
    LayerRaster,
    LayerSymbol
];
