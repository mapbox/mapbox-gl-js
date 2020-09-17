// @flow

import StyleLayer from '../style_layer';

import properties from './hillshade_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {PaintProps} from './hillshade_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import ProgramConfiguration from '../../data/program_configuration';

class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    hasOffscreenPass() {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }

    getProgramIds() {
        return ['hillshade', 'hillshadePrepare'];
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export default HillshadeStyleLayer;
