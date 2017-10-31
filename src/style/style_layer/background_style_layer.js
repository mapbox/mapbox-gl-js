// @flow

const StyleLayer = require('../style_layer');
const properties = require('./background_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type {PaintProperties} from './background_style_layer_properties';

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProperties>;
    _transitioningPaint: Transitioning<PaintProperties>;
    paint: PossiblyEvaluated<PaintProperties>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

module.exports = BackgroundStyleLayer;
