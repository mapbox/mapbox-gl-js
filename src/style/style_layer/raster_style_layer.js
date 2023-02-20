// @flow

import StyleLayer from '../style_layer.js';

import properties from './raster_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {RGBAImage} from '../../util/image.js';

import type {PaintProps} from './raster_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type Texture from '../../render/texture.js';

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this._updateColorRamp();
    }

    getProgramIds(): Array<string> {
        return ['raster'];
    }

    hasColorMap(): boolean {
        const expr = this._transitionablePaint._values['raster-color'].value;
        return !!expr.value;
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
        });
        this.colorRampTexture = null;
    }
}

export default RasterStyleLayer;
