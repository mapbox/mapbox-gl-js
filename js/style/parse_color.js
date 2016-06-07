'use strict';

var parseColorString = require('csscolorparser').parseCSSColor;
var util = require('../util/util');
var StyleFunction = require('./style_function');

var cache = {};

module.exports = function parseColor(input) {

    if (StyleFunction.isFunctionDefinition(input)) {

        return util.extend({}, input, {
            stops: input.stops.map(function(stop) {
                return [stop[0], parseColor(stop[1])];
            })
        });

    } else if (typeof input === 'string') {

        if (!cache[input]) {
            var rgba = parseColorString(input);
            if (!rgba) { throw new Error('Invalid color ' + input); }

            // GL expects all components to be in the range [0, 1] and to be
            // multipled by the alpha value.
            cache[input] = [
                rgba[0] / 255 * rgba[3],
                rgba[1] / 255 * rgba[3],
                rgba[2] / 255 * rgba[3],
                rgba[3]
            ];
        }

        return cache[input];

    } else {
        throw new Error('Invalid color ' + input);
    }
};
