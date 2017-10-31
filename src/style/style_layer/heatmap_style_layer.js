// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');
const RGBAImage = require('../../util/image').RGBAImage;

import type Texture from '../../render/texture';
import type Color from '../../style-spec/util/color';

class HeatmapStyleLayer extends StyleLayer {

    heatmapTexture: ?WebGLTexture;
    heatmapFbo: ?WebGLFramebuffer;
    colorRampData: Uint8Array;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification) {
        super(layer);
        this.colorRampData = new Uint8Array(256 * 4);

        // make sure color ramp texture is generated for default heatmap color too
        if (!this.getPaintProperty('heatmap-color')) {
            this.setPaintProperty('heatmap-color', this._paintSpecifications['heatmap-color'].default, '');
        }
    }

    // we can't directly override setPaintProperty because it's asynchronous in the sense that
    // getPaintValue call immediately after it won't return relevant values, it needs to wait
    // until all paint transition have been updated (which usually happens once per frame)
    _applyPaintDeclaration(name: any, declaration: any, options: any, globalOptions: any, animationLoop: any, zoomHistory: any) {
        super._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory);
        if (name === 'heatmap-color') {
            const len = this.colorRampData.length;
            for (let i = 4; i < len; i += 4) {
                const pxColor: Color = this.getPaintValue('heatmap-color', {heatmapDensity: i / len, zoom: -1});
                // the colors are being unpremultiplied because getPaintValue returns
                // premultiplied values, and the Texture class expects unpremultiplied ones
                this.colorRampData[i + 0] = Math.floor(pxColor.r * 255 / pxColor.a);
                this.colorRampData[i + 1] = Math.floor(pxColor.g * 255 / pxColor.a);
                this.colorRampData[i + 2] = Math.floor(pxColor.b * 255 / pxColor.a);
                this.colorRampData[i + 3] = Math.floor(pxColor.a * 255);
            }
            this.colorRamp = RGBAImage.create({width: 256, height: 1}, this.colorRampData);
            this.colorRampTexture = null;
        }
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
