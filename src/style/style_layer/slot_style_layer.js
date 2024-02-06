// @flow

import StyleLayer from '../style_layer.js';

import properties from './slot_style_layer_properties.js';

import type {LayerSpecification} from '../../style-spec/types.js';

class SlotStyleLayer extends StyleLayer {
    constructor(layer: LayerSpecification, scope: string, _: mixed) {
        super(layer, properties, scope);
    }
}

export default SlotStyleLayer;
