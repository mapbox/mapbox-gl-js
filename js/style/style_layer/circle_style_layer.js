'use strict';

const util = require('../../util/util');
const StyleLayer = require('../style_layer');

function CircleStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = CircleStyleLayer;

CircleStyleLayer.prototype = util.inherit(StyleLayer, {});
