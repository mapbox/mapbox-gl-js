'use strict';

var parseCSSColor = require('csscolorparser').parseCSSColor;
var util = require('../util/util');

var colorCache = {};

function parseColor(input) {

    if (colorCache[input]) {
        return colorCache[input];

    // RGBA array
    } else if (Array.isArray(input)) {
        return input;

    // GL function
    } else if (input && input.stops) {
        return util.extend({}, input, {
            stops: input.stops.map(parseFunctionStopColor)
        });

    // Color string
    } else if (typeof input === 'string') {
        var parsedColor = parseCSSColor(input);
        if (!parsedColor) { throw new Error('Invalid color ' + input); }

        var output = colorDowngrade(parsedColor);
        colorCache[input] = output;
        return output;

    } else {
        throw new Error('Invalid color ' + input);
    }

}

function parseFunctionStopColor(stop) {
    return [stop[0], parseColor(stop[1])];
}

function colorDowngrade(color) {
    return [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 1];
}

module.exports = parseColor;
