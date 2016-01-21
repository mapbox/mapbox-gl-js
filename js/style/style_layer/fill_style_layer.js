'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function FillStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = FillStyleLayer;

FillStyleLayer.prototype = util.inherit(StyleLayer, {});
