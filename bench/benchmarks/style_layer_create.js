// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import Benchmark from '../lib/benchmark';
import createStyleLayer from '../../src/style/create_style_layer';
import deref from '../../src/style-spec/deref';
import fetchStyle from '../lib/fetch_style';

export default class StyleLayerCreate extends Benchmark {
    style: string | StyleSpecification;
    layers: Array<Object>;

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    setup(): Promise<void> {
        return fetchStyle(this.style)
            .then(json => { this.layers = deref(json.layers); });
    }

    bench() {
        for (const layer of this.layers) {
            createStyleLayer(layer);
        }
    }
}
