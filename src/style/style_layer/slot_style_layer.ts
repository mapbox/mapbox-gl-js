import StyleLayer from '../style_layer';

import properties from './slot_style_layer_properties';

import type {LayerSpecification} from '../../style-spec/types';
import type {LUT} from "../../util/lut";

class SlotStyleLayer extends StyleLayer {
    constructor(layer: LayerSpecification, scope: string, _lut: LUT | null, _: unknown) {
        super(layer, properties, scope, null);
    }
}

export default SlotStyleLayer;
