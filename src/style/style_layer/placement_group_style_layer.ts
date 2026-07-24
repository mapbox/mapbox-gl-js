import StyleLayer from '../style_layer';
import {getPaintProperties} from './placement_group_style_layer_properties';

import type {LayerSpecification} from '../../style-spec/types';
import type {LUT} from "../../util/lut";
import type {ConfigOptions} from '../properties';

class PlacementGroupStyleLayer extends StyleLayer {
    override type: 'placement-group';

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
    }
}

export default PlacementGroupStyleLayer;
