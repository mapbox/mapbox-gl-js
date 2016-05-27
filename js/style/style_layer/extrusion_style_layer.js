'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function ExtrusionStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = ExtrusionStyleLayer;

ExtrusionStyleLayer.prototype = util.inherit(StyleLayer, {});
