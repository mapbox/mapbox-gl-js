import StyleLayer from '../style_layer';
import browser from '../../util/browser';
import {getLayoutProperties, getPaintProperties} from './raster_particle_style_layer_properties';
import {renderColorRamp} from '../../util/color_ramp';

import type {PossiblyEvaluated, ConfigOptions} from '../properties';
import type {RGBAImage} from '../../util/image';
import type {Map as MapboxMap} from '../../ui/map';
import type {PaintProps} from './raster_particle_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';
import type Texture from '../../render/texture';
import type Framebuffer from '../../gl/framebuffer';
import type SourceCache from '../../source/source_cache';
import type {LUT} from "../../util/lut";
import type {ProgramName} from '../../render/program';

const COLOR_RAMP_RES = 256;

class RasterParticleStyleLayer extends StyleLayer {
    override type: 'raster-particle';

    override paint: PossiblyEvaluated<PaintProps>;

    // Shared rendering resources

    colorRamp: RGBAImage;
    colorRampTexture: Texture | null | undefined;
    tileFramebuffer: Framebuffer;
    particleFramebuffer: Framebuffer;
    particlePositionRGBAImage: RGBAImage;

    previousDrawTimestamp: number | null | undefined;
    lastInvalidatedAt: number;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this._updateColorRamp();
        this.lastInvalidatedAt = browser.now();
    }

    override _clear() {
        if (this.colorRampTexture) {
            this.colorRampTexture.destroy();
            this.colorRampTexture = null;
        }
        if (this.tileFramebuffer) {
            this.tileFramebuffer.destroy();
            this.tileFramebuffer = null;
        }
        if (this.particleFramebuffer) {
            this.particleFramebuffer.destroy();
            this.particleFramebuffer = null;
        }
    }

    override onRemove(_: MapboxMap): void {
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

    override getProgramIds(): ProgramName[] {
        return ['rasterParticle'];
    }

    override hasOffscreenPass(): boolean {
        return this.visibility !== 'none';
    }

    override isDraped(_?: SourceCache | null): boolean {
        return false;
    }

    override _handleSpecialPaintPropertyUpdate(name: string) {
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
            clips: [{start: 0, end}],
            resolution: COLOR_RAMP_RES,
        });
        this.colorRampTexture = null;
    }

    _invalidateAnimationState() {
        this.lastInvalidatedAt = browser.now();
    }

    override tileCoverLift(): number {
        return this.paint.get('raster-particle-elevation');
    }
}

export {COLOR_RAMP_RES};
export default RasterParticleStyleLayer;
