// @flow

import StyleLayer from '../style_layer.js';

import properties from './hillshade_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';

import type {PaintProps} from './hillshade_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {CreateProgramParams} from "../../render/painter.js";
import type {ConfigOptions} from '../properties.js';

class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, options?: ?ConfigOptions) {
        super(layer, properties, scope, options);
    }

    hasOffscreenPass(): boolean {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }

    getProgramIds(): Array<string> {
        return ['hillshade', 'hillshadePrepare'];
    }

    // eslint-disable-next-line no-unused-vars
    getDefaultProgramParams(name: string, zoom: number): CreateProgramParams | null {
        return {
            overrideFog: false
        };
    }
}

export default HillshadeStyleLayer;
