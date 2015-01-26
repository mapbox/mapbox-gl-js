'use strict';

var util = require('../util/util');

exports.resolve = function(value, constants) {
    function resolve(value) {
        return typeof value === 'string' && value[0] === '@' ? constants[value] : value;
    }

    var i;

    value = resolve(value);

    if (Array.isArray(value)) {
        value = value.slice();

        for (i = 0; i < value.length; i++) {
            if (value[i] in constants) {
                value[i] = resolve(value[i]);
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
