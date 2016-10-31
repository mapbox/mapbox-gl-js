'use strict';

const parseColorString = require('csscolorparser').parseCSSColor;
const util = require('../util/util');
const MapboxGLFunction = require('mapbox-gl-function');

const cache = {};

module.exports = function parseColor(input) {

    if (input && MapboxGLFunction.isFunctionDefinition(input)) {

        if (!input.stops) return input;
        else return util.extend({}, input, {
            stops: input.stops.map((stop) => {
                return [stop[0], parseColor(stop[1])];
            })
        });

    } else if (typeof input === 'string') {

        if (!cache[input]) {
            const rgba = parseColorString(input);
            if (!rgba) { throw new Error(`Invalid color ${input}`); }

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

    } else if (Array.isArray(input)) {
        return input;

    } else {
        throw new Error(`Invalid color ${input}`);
    }
};
