// @flow

import StyleLayer from '../style_layer.js';

import properties from './raster_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';

import type {PaintProps} from './raster_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    getProgramIds() {
        return ['raster'];
    }
}

export default RasterStyleLayer;
