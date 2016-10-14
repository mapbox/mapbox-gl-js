'use strict';

const util = require('../../util/util');
const StyleLayer = require('../style_layer');

function RasterStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = RasterStyleLayer;

RasterStyleLayer.prototype = util.inherit(StyleLayer, {});
