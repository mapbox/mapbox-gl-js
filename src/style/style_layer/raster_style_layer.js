// @flow

const StyleLayer = require('../style_layer');
const properties = require('./raster_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type {PaintProps} from './raster_style_layer_properties';

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

module.exports = RasterStyleLayer;
