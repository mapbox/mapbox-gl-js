// @flow

import StyleLayer from '../style_layer.js';

import HeatmapBucket from '../../data/bucket/heatmap_bucket.js';
import {RGBAImage} from '../../util/image.js';
import properties from './heatmap_style_layer_properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';

import type Texture from '../../render/texture.js';
import type Framebuffer from '../../gl/framebuffer.js';
import type {PaintProps} from './heatmap_style_layer_properties.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import ProgramConfiguration from '../../data/program_configuration.js';

class HeatmapStyleLayer extends StyleLayer {

    heatmapFbo: ?Framebuffer;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification) {
        super(layer, properties);

        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'heatmapDensity',
            image: this.colorRamp
        });
        this.colorRampTexture = null;
    }

    resize() {
        if (this.heatmapFbo) {
            this.heatmapFbo.destroy();
            this.heatmapFbo = null;
        }
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean  {
        return false;
    }

    hasOffscreenPass() {
        return this.paint.get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }

    getProgramIds() {
        return ['heatmap', 'heatmapTexture'];
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }
}

export default HeatmapStyleLayer;
