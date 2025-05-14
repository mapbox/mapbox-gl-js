import StyleLayer from '../style_layer';
import {getLayoutProperties, getPaintProperties} from './hillshade_style_layer_properties';

import type {Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {PaintProps} from './hillshade_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type {CreateProgramParams} from '../../render/painter';
import type {LUT} from "../../util/lut";
import type {ProgramName} from '../../render/program';

class HillshadeStyleLayer extends StyleLayer {
    override type: 'hillshade';

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

    shouldRedrape(): boolean {
        return this.hasOffscreenPass() && this.paint.get('hillshade-illumination-anchor') === 'viewport';
    }

    override hasOffscreenPass(): boolean {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }

    override getProgramIds(): ProgramName[] {
        return ['hillshade', 'hillshadePrepare'];
    }

    override getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        return {
            overrideFog: false
        };
    }
}

export default HillshadeStyleLayer;
