// @flow

import StyleLayer from '../style_layer.js';

import properties from './slot_style_layer_properties.js';

import type {LayerSpecification} from '../../style-spec/types.js';

class SlotStyleLayer extends StyleLayer {
    constructor(layer: LayerSpecification, _: mixed) {
        super(layer, properties);
    }
}

export default SlotStyleLayer;
