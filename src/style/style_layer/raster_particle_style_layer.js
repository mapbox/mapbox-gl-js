// @flow

import StyleLayer from '../style_layer.js';
import browser from '../../util/browser.js';
import properties from './raster_particle_style_layer_properties.js';
import {PossiblyEvaluated} from '../properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {RGBAImage} from '../../util/image.js';

import type {ConfigOptions} from "../properties";
import type MapboxMap from '../../ui/map.js';
import type {PaintProps} from './raster_particle_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type Texture from '../../render/texture.js';
import type Framebuffer from '../../gl/framebuffer.js';
import type SourceCache from '../../source/source_cache.js';

const COLOR_RAMP_RES = 256;

class RasterParticleStyleLayer extends StyleLayer {
    paint: PossiblyEvaluated<PaintProps>;

    // Shared rendering resources

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;
    transformFeedbackObject: any;
    tileFramebuffer: Framebuffer;

    previousDrawTimestamp: ?number;
    lastInvalidatedAt: number;

    constructor(layer: LayerSpecification, scope: string, options?: ?ConfigOptions) {
        super(layer, properties, scope, options);
        this._updateColorRamp();

        this.onRemove = (map: MapboxMap): void => {
            if (this.colorRampTexture) {
                this.colorRampTexture.destroy();
            }

            if (this.transformFeedbackObject) {
                const gl = map.painter.context.gl;
                // $FlowFixMe[prop-missing]
                gl.deleteTransformFeedback(this.transformFeedbackObject);
            }

            if (this.tileFramebuffer) {
                this.tileFramebuffer.destroy();
            }
        };

        this.lastInvalidatedAt = browser.now();
    }

    hasColorMap(): boolean {
        const expr = this._transitionablePaint._values['raster-particle-color'].value;
        return !!expr.value;
    }

    getProgramIds(): Array<string> {
        return ['rasterParticle'];
    }

    hasOffscreenPass(): boolean {
        return this.visibility !== 'none';
    }

    // $FlowFixMe[method-unbinding]
    isLayerDraped(_: ?SourceCache): boolean {
        return false;
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'raster-particle-color' || name === 'raster-particle-max-speed') {
            this._updateColorRamp();
            this._invalidateAnimationState();
        }

        if (name === 'raster-particle-count') {
            this._invalidateAnimationState();
        }
    }

    _updateColorRamp() {
        if (!this.hasColorMap()) return;

        const expression = this._transitionablePaint._values['raster-particle-color'].value.expression;
        const end = this._transitionablePaint._values['raster-particle-max-speed'].value.expression.evaluate({zoom: 0});

        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'rasterParticleSpeed',
            image: this.colorRamp,
            clips: [{start:0, end}],
            resolution: COLOR_RAMP_RES,
        });
        this.colorRampTexture = null;
    }

    _invalidateAnimationState() {
        this.lastInvalidatedAt = browser.now();
    }
}

export {COLOR_RAMP_RES};
export default RasterParticleStyleLayer;
