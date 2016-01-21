'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function SymbolStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = SymbolStyleLayer;

SymbolStyleLayer.prototype = util.inherit(StyleLayer, {});
