import StyleLayer from '../style_layer';
import browser from '../../util/browser';
import properties from './raster_particle_style_layer_properties';
import {PossiblyEvaluated} from '../properties';
import {renderColorRamp} from '../../util/color_ramp';
import {RGBAImage} from '../../util/image';

import type {ConfigOptions} from "../properties";
import type {Map as MapboxMap} from '../../ui/map';
import type {PaintProps} from './raster_particle_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type Texture from '../../render/texture';
import type Framebuffer from '../../gl/framebuffer';
import type SourceCache from '../../source/source_cache';
import type {LUT} from "../../util/lut";

const COLOR_RAMP_RES = 256;

class RasterParticleStyleLayer extends StyleLayer {
    paint: PossiblyEvaluated<PaintProps>;

    // Shared rendering resources

    colorRamp: RGBAImage;
    colorRampTexture: Texture | null | undefined;
    tileFramebuffer: Framebuffer;
    particleFramebuffer: Framebuffer;
    particlePositionRGBAImage: RGBAImage;

    previousDrawTimestamp: number | null | undefined;
    lastInvalidatedAt: number;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);
        this._updateColorRamp();
        this.lastInvalidatedAt = browser.now();
    }

    onRemove(_: MapboxMap): void {
        if (this.colorRampTexture) {
            this.colorRampTexture.destroy();
        }

        if (this.tileFramebuffer) {
            this.tileFramebuffer.destroy();
        }

        if (this.particleFramebuffer) {
            this.particleFramebuffer.destroy();
        }
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

    isDraped(_?: SourceCache | null): boolean {
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
