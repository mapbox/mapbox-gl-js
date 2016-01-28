'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function BackgroundStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = BackgroundStyleLayer;

BackgroundStyleLayer.prototype = util.inherit(StyleLayer, {});
