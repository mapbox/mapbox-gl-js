'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function BuildingStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = BuildingStyleLayer;

BuildingStyleLayer.prototype = util.inherit(StyleLayer, {});
