
import style from '../data/empty.json';
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

function generateLayers(layer) {
    const generated = [];
    for (let i = 0; i < 50; i++) {
        const id = layer.id + i;
        generated.push(Object.assign({}, layer, {id}));
    }
    return generated;
}

const width = 1024;
const height = 768;
const zoom = 4;

class RemovePaintState extends Benchmark {
    constructor(center) {
        super();
        this.center = center;
    }

    setup() {
        return fetch('/bench/data/naturalearth-land.json')
            .then(response => response.json())
            .then(data => {
                this.numFeatures = data.features.length;
                return Object.assign({}, style, {
                    sources: {'land': {'type': 'geojson', data, 'maxzoom': 23}},
                    layers: generateLayers({
                        'id': 'layer',
                        'type': 'fill',
                        'source': 'land',
                        'paint': {
                            'fill-color': [
                                'case',
                                ['boolean', ['feature-state', 'bench'], false],
                                ['rgb', 21, 210, 210],
                                ['rgb', 233, 233, 233]
                            ]
                        }
                    })
                });
            })
            .then((style) => {
                return createMap({
                    zoom,
                    width,
                    height,
                    center: this.center,
                    style
                }).then(map => {
                    this.map = map;
                })
                    .catch(error => {
                        console.error(error);
                    });
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

export class PropertyLevelRemove extends RemovePaintState {
    bench() {

        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.setFeatureState({source: 'land', id: i}, {bench: true});
        }
        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.removeFeatureState({source: 'land', id: i}, 'bench');
        }
        this.map._render();

    }
}

export class FeatureLevelRemove extends RemovePaintState {
    bench() {

        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.setFeatureState({source: 'land', id: i}, {bench: true});
        }
        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.removeFeatureState({source: 'land', id: i});
        }
        this.map._render();

    }
}

export class SourceLevelRemove extends RemovePaintState {
    bench() {

        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.setFeatureState({source: 'land', id: i}, {bench: true});
        }
        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.removeFeatureState({source: 'land', id: i});
        }
        this.map._render();

    }
}
