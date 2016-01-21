'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function FillStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = FillStyleLayer;

FillStyleLayer.prototype = util.inherit(StyleLayer, {

    premultiply: function() {
        this.paint['fill-color'] = util.premultiply(this.paint['fill-color'], this.paint['fill-opacity']);
        this.paint['fill-outline-color'] = util.premultiply(this.paint['fill-outline-color'], this.paint['fill-opacity']);
    }

});
