// @flow

import StyleLayer from '../../../src/style/style_layer.js';

import type {LayerSpecification} from '../../../src/style-spec/types.js';
import properties from './model_style_layer_properties.js';


class ModelStyleLayer extends StyleLayer {
    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default ModelStyleLayer;
