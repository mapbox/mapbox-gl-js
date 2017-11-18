// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');
const RGBAImage = require('../../util/image').RGBAImage;
const properties = require('./heatmap_style_layer_properties');

const {
    Transitionable,
    Transitioning,
    PossiblyEvaluated
} = require('../properties');

import type Texture from '../../render/texture';
import type {PaintProps} from './heatmap_style_layer_properties';

class HeatmapStyleLayer extends StyleLayer {

    heatmapTexture: ?WebGLTexture;
    heatmapFbo: ?WebGLFramebuffer;
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

    setPaintProperty(name: string, value: mixed, options: {validate: boolean}) {
        super.setPaintProperty(name, value, options);
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        const colorRampData = new Uint8Array(256 * 4);
        const len = colorRampData.length;
        for (let i = 4; i < len; i += 4) {
            const pxColor = expression.evaluate(({heatmapDensity: i / len}: any));
            // the colors are being unpremultiplied because Color uses
            // premultiplied values, and the Texture class expects unpremultiplied ones
            colorRampData[i + 0] = Math.floor(pxColor.r * 255 / pxColor.a);
            colorRampData[i + 1] = Math.floor(pxColor.g * 255 / pxColor.a);
            colorRampData[i + 2] = Math.floor(pxColor.b * 255 / pxColor.a);
            colorRampData[i + 3] = Math.floor(pxColor.a * 255);
        }
        this.colorRamp = RGBAImage.create({width: 256, height: 1}, colorRampData);
        this.colorRampTexture = null;
    }

    resize(gl: WebGLRenderingContext) {
        if (this.heatmapTexture) {
            gl.deleteTexture(this.heatmapTexture);
            this.heatmapTexture = null;
        }
        if (this.heatmapFbo) {
            gl.deleteFramebuffer(this.heatmapFbo);
            this.heatmapFbo = null;
        }
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean  {
        return false;
    }
}

module.exports = HeatmapStyleLayer;
