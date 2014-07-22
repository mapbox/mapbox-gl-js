'use strict';

var util = require('../util/util.js');

module.exports.resolve = function (properties, constants) {
    var result = {}, i;

    function resolve(value) {
        return typeof value === 'string' && value[0] === '@' ? constants[value] : value;
    }

    for (var key in properties) {
        var value = resolve(properties[key]);

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

        result[key] = value;
    }

    return result;
};
