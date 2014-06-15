'use strict';

var reference = require('mapbox-gl-style-spec').v2;

module.exports = CalculatedStyle;

addDefaultValues();

function CalculatedStyle() {}

function addDefaultValues() {
    var style = reference.style;
    for (var prop in style) {
        var value = style[prop]['default'];
        if (value !== undefined) {
            CalculatedStyle.prototype[prop] = value;
        }
    }
}
