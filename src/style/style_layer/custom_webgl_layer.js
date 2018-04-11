// @flow

import StyleLayer from '../style_layer';

import properties from './custom_webgl_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type {PaintProps} from './custom_webgl_style_layer_properties';

class CustomWebGLLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default CustomWebGLLayer;
