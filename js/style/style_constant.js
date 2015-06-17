'use strict';

var util = require('../util/util');

/**
 * Given a value that may be a constant reference and an object
 * of constants, try to detect whether the value is a constant reference
 * and return the constant value if so. This will also try to resolve
 * any constants used in composite values like ramp stops.
 *
 * @param {*} value any value in a layout or paint property
 * @param {Object} constants object with constant values
 * @returns {*} a resolved value
 * @private
 */
exports.resolve = function resolve(value, constants) {
    function resolveInner(value) {
        return typeof value === 'string' && value[0] === '@' ? constants[value].value : value;
    }

    var i;

    value = resolveInner(value);

    function resolveArray(value) {
        if (Array.isArray(value)) {
            for (var x = 0; x < value.length; x++) {
                value[x] = resolveArray(value[x]);
                if (value[x] in constants) {
                    value[x] = resolveInner(value[x]);
                }
            }
        }
        return value;
    }

    value = resolveArray(value);

    if (Array.isArray(value)) {
        // avoid mutating the array in-place
        value = value.slice();
        for (i = 0; i < value.length; i++) {
            if (value[i] in constants) {
                value[i] = resolveInner(value[i]);
            }
        }
    }

    if (value.stops) {
        // avoid mutating the object or stops array in-place
        value = util.extend({}, value);
        value.stops = value.stops.slice();

        for (i = 0; i < value.stops.length; i++) {
            value.stops[i][1] = resolveArray(value.stops[i][1]);
            if (value.stops[i][1] in constants) {
                value.stops[i] = [
                    value.stops[i][0],
                    resolveInner(value.stops[i][1])
                ];
            }
        }
    }

    return value;
};

/**
 * Given an object where the values maybe constant references,
 * return a value of that object with those references resolved.
 *
 * @param {Object} properties input object
 * @param {Object|false} constants constants object - nullable
 * @returns {Object} resolved object
 * @private
 */
exports.resolveAll = function resolveAll(properties, constants) {
    if (!constants) {
        return properties;
    }

    var result = {};

    for (var key in properties) {
        result[key] = exports.resolve(properties[key], constants);
    }

    return result;
};
