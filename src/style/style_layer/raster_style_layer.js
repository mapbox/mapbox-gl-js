// @flow

const StyleLayer = require('../style_layer');

class RasterStyleLayer extends StyleLayer {
    isOpacityZero(zoom: number) {
        return super.getPaintValue('raster-opacity', { zoom: zoom }) === 0;
    }
}

module.exports = RasterStyleLayer;
