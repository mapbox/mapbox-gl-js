var parseCSSColor = require('csscolorparser').parseCSSColor;
var ColorOps = require('color-ops');
var MapboxGLFunction = require('mapbox-gl-function');
var util = require('./util');

var colorCache = {};
function parseColor(input) {

    var output;
    if (colorCache[input]) {
        return colorCache[input];

    // RGBA array
    } else if (Array.isArray(input) && typeof input[0] === 'number') {
        return input;

    // GL function
    } else if (MapboxGLFunction.is(input)) {
        return util.extend({}, input, {range: input.range.map(parseColor)});

    // CSS color string
    } else if (isString(input)) {
        output = colorDowngrade(parseCSSColor(input));

    // color operation array
    } else if (Array.isArray(input)) {
        var op = input[0];
        var degree = input[1];
        input[2] = colorUpgrade(parseColor(input[2]));

        if (op === 'mix') {
            input[3] = colorUpgrade(parseColor(input[3]));
            output = colorDowngrade(ColorOps[op](input[2], input[3], degree));
        } else {
            output = colorDowngrade(ColorOps[op](input[2], degree));
        }
    }

    colorCache[input] = output;

    return output;
}

function colorUpgrade(color) {
    return [color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 1];
}

function colorDowngrade(color) {
    return [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 1];
}

function isString(value) {
    return typeof value === 'string' || value instanceof String;
}

module.exports = parseColor;