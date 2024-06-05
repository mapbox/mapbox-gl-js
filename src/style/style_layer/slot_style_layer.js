// @flow

import StyleLayer from '../style_layer.js';

import properties from './slot_style_layer_properties.js';

import type {LayerSpecification} from '../../style-spec/types.js';
import type {LUT} from "../../util/lut";

class SlotStyleLayer extends StyleLayer {
    constructor(layer: LayerSpecification, scope: string, _lut: LUT | null, _: mixed) {
        super(layer, properties, scope, null);
    }
}

export default SlotStyleLayer;
