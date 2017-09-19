// @flow

const StyleLayer = require('../style_layer');
const HeatmapBucket = require('../../data/bucket/heatmap_bucket');

class HeatmapStyleLayer extends StyleLayer {
    createBucket(options) {
        return new HeatmapBucket(options);
    }

    constructor(layer) {
        super(layer);
        this.colorRamp = new Uint8Array(256 * 4);
        if (!this.getPaintProperty('heatmap-color')) {
            this.setPaintProperty('heatmap-color', this._paintSpecifications['heatmap-color'].default);
        }
    }

    _applyPaintDeclaration(name: any, declaration: any, options: any, globalOptions: any, animationLoop: any, zoomHistory: any) {
        super._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory);
        if (name === 'heatmap-color') {
            const len = this.colorRamp.length;
            for (let i = 4; i < len; i += 4) {
                const pxColor = this.getPaintValue('heatmap-color', {zoom: i / len});
                this.colorRamp[i + 0] = Math.floor(pxColor[0] * 255);
                this.colorRamp[i + 1] = Math.floor(pxColor[1] * 255);
                this.colorRamp[i + 2] = Math.floor(pxColor[2] * 255);
                this.colorRamp[i + 3] = Math.floor(pxColor[3] * 255);
            }
        }
    }
}

module.exports = HeatmapStyleLayer;
