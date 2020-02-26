
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import style from '../data/empty.json';

const width = 1024;
const height = 768;
const layerCount = 50;

function generateLayers(layer) {
    const generated = [];
    for (let i = 0; i < layerCount; i++) {
        const id = layer.id + i;
        generated.push(Object.assign({}, layer, {id}));
    }
    return generated;
}

export class LayerBenchmark extends Benchmark {
    setup() {
        return createMap({
            zoom: 16,
            width,
            height,
            center: [-77.032194, 38.912753],
            style: this.layerStyle
        }).then(map => {
            this.map = map;
        }).catch(error => {
            console.error(error);
        });
    }

    bench() {
        this.map._render();
    }

    teardown() {
        this.map.remove();
    }
}

export class LayerBackground extends LayerBenchmark {
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

export class LayerCircle extends LayerBenchmark {
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

export class LayerFill extends LayerBenchmark {
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

export class LayerFillExtrusion extends LayerBenchmark {
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

export class LayerHeatmap extends LayerBenchmark {
    setup() {
        return fetch('/bench/data/naturalearth-land.json')
            .then(response => response.json())
            .then(data => {
                this.layerStyle = Object.assign({}, style, {
                    sources: {
                        'heatmap': {
                            'type': 'geojson',
                            data,
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

export class LayerHillshade extends LayerBenchmark {
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

export class LayerLine extends LayerBenchmark {
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

export class LayerRaster extends LayerBenchmark {
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

export class LayerSymbol extends LayerBenchmark {
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

export class LayerSymbolWithIcons extends LayerBenchmark {
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
                    'text-field': ['format', ['get', 'name_en'], ['image', 'dot-11']]
                }
            })
        });
    }
}

export class LayerSymbolWithSortKey extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: this.generateSortKeyLayers()
        });
    }

    generateSortKeyLayers() {
        const generated = [];
        for (let i = 0; i < layerCount; i++) {
            generated.push({
                'id': `symbollayer${i}`,
                'type': 'symbol',
                'source': 'composite',
                'source-layer': 'poi_label',
                'layout': {
                    'symbol-sort-key': i,
                    'text-field': '{name_en}'
                }
            });
        }
        return generated;
    }
}

export class LayerTextWithVariableAnchor extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'composite',
                'source-layer': 'poi_label',
                'layout': {
                    'text-field': 'Test Test Test',
                    'text-justify': 'auto',
                    'text-variable-anchor': [
                        'center',
                        'top',
                        'bottom',
                        'left',
                        'right',
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right'
                    ]
                }
            })
        });
    }
}
