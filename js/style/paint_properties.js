'use strict';

var reference = require('./reference');
var colorOP = require('mapbox-gl-color-operations');

module.exports = {};

reference.paint.forEach(function(className) {
    var Calculated = function() {};

    var properties = reference[className];
    for (var p in properties) {
        var prop = properties[p],
            value = prop.default;

        if (value === undefined) continue;
        if (prop.type === 'color') value = colorOP.parse(value);

        Calculated.prototype[p] = value;
    }

    Calculated.prototype.hidden = false;
    module.exports[className.replace('paint_', '')] = Calculated;
});
