// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');
const RGBAImage = require('../../util/image').RGBAImage;

import type Texture from '../../render/texture';

class HeatmapStyleLayer extends StyleLayer {

    heatmapTexture: ?WebGLTexture;
    heatmapFbo: ?WebGLFramebuffer;
    colorRampData: Uint8Array;
    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    isOpacityZero(zoom: number) {
        return this.getPaintValue('heatmap-opacity', { zoom: zoom }) === 0;
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
                const pxColor = this.getPaintValue('heatmap-color', {heatmapDensity: i / len, zoom: -1});
                const alpha = pxColor[3];
                // the colors are being unpremultiplied because getPaintValue returns
                // premultiplied values, and the Texture class expects unpremultiplied ones
                this.colorRampData[i + 0] = Math.floor(pxColor[0] * 255 / alpha);
                this.colorRampData[i + 1] = Math.floor(pxColor[1] * 255 / alpha);
                this.colorRampData[i + 2] = Math.floor(pxColor[2] * 255 / alpha);
                this.colorRampData[i + 3] = Math.floor(alpha * 255);
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
}

module.exports = HeatmapStyleLayer;
