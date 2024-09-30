import StyleLayer from '../style_layer';
import {getLayoutProperties, getPaintProperties} from './background_style_layer_properties';

import type {Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {PaintProps} from './background_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type {CreateProgramParams} from '../../render/painter';
import type {LUT} from "../../util/lut";

class BackgroundStyleLayer extends StyleLayer {
    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
    }

    override getProgramIds(): Array<string> {
        const image = this.paint.get('background-pattern');
        return [image ? 'backgroundPattern' : 'background'];
    }

    override getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            overrideFog: false
        };
    }

    override is3D(): boolean {
        return this.paint.get('background-pitch-alignment') === 'viewport';
    }
}

export default BackgroundStyleLayer;
