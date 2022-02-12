// @flow

import StyleLayer from '../style_layer.js';

import properties from './background_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';

import type {PaintProps} from './background_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    getProgramIds(): Array<string> {
        const image = this.paint.get('background-pattern');
        return [image ? 'backgroundPattern' : 'background'];
    }
}

export default BackgroundStyleLayer;
