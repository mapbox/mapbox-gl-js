'use strict';

var util = require('../util/util');

exports.resolve = function(value, constants) {
    function resolve(value) {
        return typeof value === 'string' && value[0] === '@' ? constants[value] : value;
    }

    var i;

    value = resolve(value);

    function resolveArray(value) {
        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                value[i] = resolveArray(value[i]);
                if (value[i] in constants) {
                    value[i] = resolve(value[i]);
                }
            }
        }
        return value;
    }

    value = resolveArray(value);

    if (value.stops) {
        value = util.extend({}, value);
        value.stops = value.stops.slice();

        for (i = 0; i < value.stops.length; i++) {
            value.stops[i][1] = resolveArray(value.stops[i][1]);
            if (value.stops[i][1] in constants) {
                value.stops[i] = [
                    value.stops[i][0],
                    resolve(value.stops[i][1])
                ];
            }
        }
    }

    return value;
};

exports.resolveAll = function (properties, constants) {
    if (!constants)
        return properties;

    var result = {};

    for (var key in properties) {
        result[key] = exports.resolve(properties[key], constants);
    }

    return result;
};
