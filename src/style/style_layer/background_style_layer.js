// @flow

const StyleLayer = require('../style_layer');

class BackgroundStyleLayer extends StyleLayer {
    isOpacityZero(zoom: number) {
        return this.getPaintValue('background-opacity', { zoom: zoom }) === 0;
    }
}

module.exports = BackgroundStyleLayer;
