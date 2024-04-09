// @flow

import StyleLayer from '../style_layer.js';

import properties from './raster_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {RGBAImage} from '../../util/image.js';
import ImageSource from '../../source/image_source.js';

import type {PaintProps} from './raster_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type Texture from '../../render/texture.js';
import type {ConfigOptions} from '../properties.js';
import type SourceCache from '../../source/source_cache.js';

export const COLOR_RAMP_RES = 256;
export const COLOR_MIX_FACTOR = (Math.pow(COLOR_RAMP_RES, 2) - 1) / (255 * COLOR_RAMP_RES * (COLOR_RAMP_RES + 3));

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    // Cache the currently-computed range so that we can call updateColorRamp
    // during raster color rendering, at which point we can make use of the
    // source's data range in case raster-color-range is not explicitly specified
    // in the style. This allows us to call multiple times and only update if
    // it's changed.
    _curRampRange: [number, number];

    constructor(layer: LayerSpecification, scope: string, options?: ?ConfigOptions) {
        super(layer, properties, scope, options);
        this.updateColorRamp();
        this._curRampRange = [NaN, NaN];
    }

    getProgramIds(): Array<string> {
        return ['raster'];
    }

    hasColorMap(): boolean {
        const expr = this._transitionablePaint._values['raster-color'].value;
        return !!expr.value;
    }

    tileCoverLift(): number {
        return this.paint.get('raster-elevation');
    }

    // $FlowFixMe[method-unbinding]
    isLayerDraped(sourceCache: ?SourceCache): boolean {
        // Special handling for raster, where the drapeability depends on the source
        if (sourceCache && sourceCache._source instanceof ImageSource) {
            // If tile ID is missing, it's rendered outside of the tile pyramid (eg. poles)
            if (sourceCache._source.onNorthPole || sourceCache._source.onSouthPole) {
                return false;
            }
        }
        return this.paint.get('raster-elevation') === 0.0;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'raster-color' || name === 'raster-color-range') {
            // Force recomputation
            this._curRampRange = [NaN, NaN];

            this.updateColorRamp();
        }
    }

    updateColorRamp(overrideRange: ?[number, number]) {
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
