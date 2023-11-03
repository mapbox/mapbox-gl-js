// @flow

import StyleLayer from '../style_layer.js';

import properties from './raster_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {RGBAImage} from '../../util/image.js';

import type {PaintProps} from './raster_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type Texture from '../../render/texture.js';
import type {Expression} from '../../style-spec/expression/expression.js';
import ImageSource from '../../source/image_source.js';
import SourceCache from '../../source/source_cache.js';

const COLOR_RAMP_RES = 256;

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    constructor(layer: LayerSpecification, options?: ?Map<string, Expression>) {
        super(layer, properties, options);
        this._updateColorRamp();
    }

    getProgramIds(): Array<string> {
        return ['raster'];
    }

    hasColorMap(): boolean {
        const expr = this._transitionablePaint._values['raster-color'].value;
        return !!expr.value;
    }

    // $FlowFixMe[method-unbinding]
    isLayerDraped(sourceCache: ?SourceCache): boolean {
        // Special handling for raster, where the drapeability depends on the source
        // If tile ID is missing, it's rendered outside of the tile pyramid (eg. poles)
        if (sourceCache && sourceCache._source instanceof ImageSource && (sourceCache._source.onNorthPole || sourceCache._source.onSouthPole)) {
            return false;
        }
        return true;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'raster-color' || name === 'raster-color-range') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        if (!this.hasColorMap()) return;

        const expression = this._transitionablePaint._values['raster-color'].value.expression;
        const [start, end] = this._transitionablePaint._values['raster-color-range'].value.expression.evaluate({zoom: 0});

        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'rasterValue',
            image: this.colorRamp,
            clips: [{start, end}],
            resolution: COLOR_RAMP_RES,
        });
        this.colorRampTexture = null;
    }
}

export {COLOR_RAMP_RES};
export default RasterStyleLayer;
