'use strict';

var reference = require('./reference');
var parseCSSColor = require('csscolorparser').parseCSSColor;
var colorOps = require('color-ops');

module.exports = {};

reference.paint.forEach(function(className) {
    var Calculated = function() {};

    var properties = reference[className];
    for (var p in properties) {
        var prop = properties[p],
            value = prop.default;

        if (value === undefined) continue;
        if (prop.type === 'color') {
            if (Array.isArray(value)) {
                value = colorOps[value[0]](value[2], value[1]);
            } else {
                value = parseCSSColor(value);
            }
        }

        Calculated.prototype[p] = value;
    }

    Calculated.prototype.hidden = false;
    module.exports[className.replace('paint_', '')] = Calculated;
});
