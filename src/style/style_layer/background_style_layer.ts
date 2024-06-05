import StyleLayer from '../style_layer';

import properties from './background_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {PaintProps} from './background_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type {CreateProgramParams} from '../../render/painter';
import type {ConfigOptions} from '../properties';
import type {LUT} from "../../util/lut";

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);
    }

    getProgramIds(): Array<string> {
        const image = this.paint.get('background-pattern');
        return [image ? 'backgroundPattern' : 'background'];
    }

    // eslint-disable-next-line no-unused-vars
    getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            overrideFog: false
        };
    }
}

export default BackgroundStyleLayer;
