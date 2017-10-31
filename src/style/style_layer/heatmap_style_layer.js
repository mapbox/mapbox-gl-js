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
import type {PaintProperties} from './heatmap_style_layer_properties';

class HeatmapStyleLayer extends StyleLayer {

    heatmapTexture: ?WebGLTexture;
    heatmapFbo: ?WebGLFramebuffer;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProperties>;
    _transitioningPaint: Transitioning<PaintProperties>;
    paint: PossiblyEvaluated<PaintProperties>;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    updatePaintTransitions(options: {transition?: boolean}, transition: TransitionSpecification) {
        super.updatePaintTransitions(options, transition);
        this.colorRamp = this._transitioningPaint._values['heatmap-color'].possiblyEvaluate(({zoom: 0}: any));
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
