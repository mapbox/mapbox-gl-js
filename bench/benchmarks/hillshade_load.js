// @flow

import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {StyleSpecification} from '../../src/style-spec/types';

export default class HillshadeLoad extends Benchmark {
    style: StyleSpecification;

    constructor() {
        super();
        this.style = {
            "version": 8,
            "name": "Hillshade-only",
            "center": [-112.81596278901452, 37.251160384573595],
            "zoom": 11.560975632435424,
            "bearing": 0,
            "pitch": 0,
            "sources": {
                "mapbox://mapbox.terrain-rgb": {
                    "url": "mapbox://mapbox.terrain-rgb",
                    "type": "raster-dem",
                    "tileSize": 256
                }
            },
            "layers": [
                {
                    "id": "mapbox-terrain-rgb",
                    "type": "hillshade",
                    "source": "mapbox://mapbox.terrain-rgb",
                    "layout": {},
                    "paint": {}
                }
            ]
        };
    }

    bench() {
        return createMap({
            width: 1024,
            height: 1024,
            style: this.style,
            stubRender: false,
            showMap: true,
            idle: true
        }).then((map) => {
            map.remove();
        });
    }
}
