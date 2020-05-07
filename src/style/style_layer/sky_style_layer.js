// @flow

import StyleLayer from '../style_layer';
import properties from './sky_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';
import {renderColorRamp} from '../../util/color_ramp';
import type {PaintProps} from './sky_style_layer_properties';
import type Texture from '../../render/texture';
import type {LayerSpecification} from '../../style-spec/types';
import type Framebuffer from '../../gl/framebuffer';
import type {RGBAImage} from '../../util/image';
import type SkyboxGeometry from '../../render/skybox_geometry';

class SkyLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    skyboxFbo: ?Framebuffer;
    skyboxTexture: ?WebGLTexture;
    _skyboxInvalidated: ?boolean;

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    skyboxGeometry: SkyboxGeometry;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'sky-gradient') {
            this._updateColorRamp();
        } else if (name === 'sky-sun-direction' ||
                   name === 'sky-atmosphere-halo-color' ||
                   name === 'sky-atmosphere-color') {
            this._skyboxInvalidated = true;
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['sky-gradient'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'skyRadialProgress'
        });
        if (this.colorRampTexture) {
            this.colorRampTexture.destroy();
            this.colorRampTexture = null;
        }
    }

    needsSkyboxCapture() {
        return !!this._skyboxInvalidated || !this.skyboxTexture || !this.skyboxGeometry;
    }

    is3D() {
        return false;
    }

    isSky() {
        return true;
    }

    markSkyboxValid() {
        this._skyboxInvalidated = false;
    }

    hasOffscreenPass() {
        return true;
    }
}

export default SkyLayer;
