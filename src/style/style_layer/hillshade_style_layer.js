// @flow

import StyleLayer from '../style_layer';

import properties from './hillshade_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type Painter from '../../render/painter';
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

    getProgramId(painter: ?Painter): string {
        if (!painter) return '';

        if (painter.renderPass === 'translucent') {
            return 'hillshade';
        } else {
            return 'hillshadePrepare';
        }
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export default HillshadeStyleLayer;
