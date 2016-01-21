'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function CircleStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = CircleStyleLayer;

CircleStyleLayer.prototype = util.inherit(StyleLayer, {});
