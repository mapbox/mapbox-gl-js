'use strict';

var reference = require('mapbox-gl-style-spec/reference/v4');

module.exports = {};

reference['class'].forEach(function(className) {
    var Calculated = function() {};
    var style = reference[className];
    for (var prop in style) {
        if (style[prop]['default'] === undefined) continue;
        Calculated.prototype[prop] = style[prop]['default'];
    }
    module.exports[className.replace('class_','')] = Calculated;
});

