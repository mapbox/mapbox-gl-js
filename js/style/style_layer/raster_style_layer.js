'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function RasterStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = RasterStyleLayer;

RasterStyleLayer.prototype = util.inherit(StyleLayer, {});
