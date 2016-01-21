'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function LineStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = LineStyleLayer;

LineStyleLayer.prototype = util.inherit(StyleLayer, {});
