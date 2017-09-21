// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');
const RGBAImage = require('../../util/image').RGBAImage;

class HeatmapStyleLayer extends StyleLayer {

    createBucket(options) {
        return new HeatmapBucket(options);
    }

    constructor(layer) {
        super(layer);
        this.colorRampData = new Uint8Array(256 * 4);
        if (!this.getPaintProperty('heatmap-color')) {
            this.setPaintProperty('heatmap-color', this._paintSpecifications['heatmap-color'].default);
        }
    }

    _applyPaintDeclaration(name: any, declaration: any, options: any, globalOptions: any, animationLoop: any, zoomHistory: any) {
        super._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory);
        if (name === 'heatmap-color') {
            const len = this.colorRampData.length;
            for (let i = 4; i < len; i += 4) {
                const pxColor = this.getPaintValue('heatmap-color', {zoom: i / len});
                const alpha = pxColor[3];
                this.colorRampData[i + 0] = Math.floor(pxColor[0] * 255 / alpha);
                this.colorRampData[i + 1] = Math.floor(pxColor[1] * 255 / alpha);
                this.colorRampData[i + 2] = Math.floor(pxColor[2] * 255 / alpha);
                this.colorRampData[i + 3] = Math.floor(alpha * 255);
            }
            this.colorRamp = RGBAImage.create({width: 256, height: 1}, this.colorRampData);
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
