// @flow

import StyleLayer from '../../../src/style/style_layer.js';

import type {LayerSpecification} from '../../../src/style-spec/types.js';
import properties from './model_style_layer_properties.js';
import type {PaintProps} from './model_style_layer_properties.js';
import {PossiblyEvaluated} from '../../../src/style/properties.js';

class ModelStyleLayer extends StyleLayer {
    paint: PossiblyEvaluated<PaintProps>;
    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default ModelStyleLayer;
