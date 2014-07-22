'use strict';

var util = require('../util/util.js');

module.exports.resolve = function (properties, constants) {
    var result = {};

    function resolve(value) {
        return typeof value === 'string' && value[0] === '@' ? constants[value] : value;
    }

    for (var key in properties) {
        var value = resolve(properties[key]);

        if (value.stops) {
            value = util.extend({}, value);
            value.stops = value.stops.slice();

            for (var i = 0; i < value.stops.length; i++) {
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
