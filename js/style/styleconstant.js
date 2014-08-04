'use strict';

var util = require('../util/util.js');

module.exports.resolve = function (properties, constants) {
    if (!constants)
        return properties;

    var result = {};

    for (var key in properties) {
        result[key] = resolveProperty(properties[key], constants);
    }

    return result;
};

module.exports.resolveProperty = resolveProperty;

function resolveProperty(value, constants) {
    value = resolve(value, constants);

    var i;

    if (Array.isArray(value)) {
        value = value.slice();

        for (i = 0; i < value.length; i++) {
            if (value[i] in constants) {
                value[i] = resolve(value[i], constants);
            }
        }
    }

    if (value.stops) {
        value = util.extend({}, value);
        value.stops = value.stops.slice();

        for (i = 0; i < value.stops.length; i++) {
            if (value.stops[i][1] in constants) {
                value.stops[i] = [
                    value.stops[i][0],
                    resolve(value.stops[i][1], constants)
                        ];
            }
        }
    }

    return value;
}

function resolve(value, constants) {
    return typeof value === 'string' && value[0] === '@' ? constants[value] : value;
}
