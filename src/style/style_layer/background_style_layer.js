// @flow

import StyleLayer from '../style_layer.js';

import properties from './background_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';

import type {PaintProps} from './background_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {CreateProgramParams} from "../../render/painter.js";
import type {ConfigOptions} from '../properties.js';

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, options?: ?ConfigOptions) {
        super(layer, properties, options);
    }

    getProgramIds(): Array<string> {
        const image = this.paint.get('background-pattern');
        return [image ? 'backgroundPattern' : 'background'];
    }

    // eslint-disable-next-line no-unused-vars
    getDefaultProgramParams(name: string, zoom: number): CreateProgramParams | null {
        return {
            overrideFog: false
        };
    }
}

export default BackgroundStyleLayer;
