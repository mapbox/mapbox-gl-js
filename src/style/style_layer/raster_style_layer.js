// @flow

import StyleLayer from '../style_layer';

import properties from './raster_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {PaintProps} from './raster_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type Painter from '../../render/painter';

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    getProgramId(painter: ?Painter) {
        if (!painter) return '';
        return 'raster';
    }
}

export default RasterStyleLayer;
