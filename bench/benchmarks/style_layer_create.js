// @flow

import Benchmark from '../lib/benchmark';
import createStyleLayer from '../../src/style/create_style_layer';
import deref from '../../src/style-spec/deref';
import { normalizeStyleURL } from '../../src/util/mapbox';

export default class StyleLayerCreate extends Benchmark {
    style: string;
    layers: Array<Object>;

    constructor(style: string) {
        super();
        this.style = style;
    }

    setup(): Promise<void> {
        return fetch(normalizeStyleURL(this.style))
            .then(response => response.json())
            .then(json => { this.layers = deref(json.layers); });
    }

    bench() {
        for (const layer of this.layers) {
            createStyleLayer(layer);
        }
    }
}
