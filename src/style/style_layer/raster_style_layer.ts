import StyleLayer from '../style_layer';
import {getLayoutProperties, getPaintProperties} from './raster_style_layer_properties';
import {renderColorRamp} from '../../util/color_ramp';
import ImageSource from '../../source/image_source';

import type {Transitionable, Transitioning, PossiblyEvaluated, ConfigOptions} from '../properties';
import type {RGBAImage} from '../../util/image';
import type {PaintProps} from './raster_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type Texture from '../../render/texture';
import type SourceCache from '../../source/source_cache';
import type {LUT} from "../../util/lut";
import type {ProgramName} from '../../render/program';

export const COLOR_RAMP_RES = 256;
export const COLOR_MIX_FACTOR = (Math.pow(COLOR_RAMP_RES, 2) - 1) / (255 * COLOR_RAMP_RES * (COLOR_RAMP_RES + 3));

class RasterStyleLayer extends StyleLayer {
    override type: 'raster';

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    colorRamp: RGBAImage;
    colorRampTexture: Texture | null | undefined;

    // Cache the currently-computed range so that we can call updateColorRamp
    // during raster color rendering, at which point we can make use of the
    // source's data range in case raster-color-range is not explicitly specified
    // in the style. This allows us to call multiple times and only update if
    // it's changed.
    _curRampRange: [number, number];

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this.updateColorRamp();
        this._curRampRange = [NaN, NaN];
    }

    override getProgramIds(): ProgramName[] {
        return ['raster'];
    }

    hasColorMap(): boolean {
        const expr = this._transitionablePaint._values['raster-color'].value;
        return !!expr.value;
    }

    override tileCoverLift(): number {
        return this.paint.get('raster-elevation');
    }

    override isDraped(sourceCache?: SourceCache | null): boolean {
        // Special handling for raster, where the drapeability depends on the source
        if (sourceCache && sourceCache._source instanceof ImageSource) {
            // If tile ID is missing, it's rendered outside of the tile pyramid (eg. poles)
            if (sourceCache._source.onNorthPole || sourceCache._source.onSouthPole) {
                return false;
            }
        }
        return this.paint.get('raster-elevation') === 0.0;
    }

    override _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'raster-color' || name === 'raster-color-range') {
            // Force recomputation
            this._curRampRange = [NaN, NaN];

            this.updateColorRamp();
        }
    }

    override _clear() {
        if (this.colorRampTexture) {
            this.colorRampTexture.destroy();
            this.colorRampTexture = null;
        }
    }

    updateColorRamp(overrideRange?: [number, number] | null) {
        if (!this.hasColorMap()) return;
        if (!this._curRampRange) return;

        const expression = this._transitionablePaint._values['raster-color'].value.expression;
        const [start, end] = overrideRange || this._transitionablePaint._values['raster-color-range'].value.expression.evaluate({zoom: 0}) || [NaN, NaN];

        if (isNaN(start) && isNaN(end)) return;
        if (start === this._curRampRange[0] && end === this._curRampRange[1]) return;

        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'rasterValue',
            image: this.colorRamp,
            clips: [{start, end}],
            resolution: COLOR_RAMP_RES,
        });
        this.colorRampTexture = null;
        this._curRampRange = [start, end];
    }
}

export default RasterStyleLayer;
