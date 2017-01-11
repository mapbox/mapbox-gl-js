'use strict';

module.exports = function (output) {
    for (var i = 1; i < arguments.length; i++) {
        var input = arguments[i];
        for (var k in input) {
            output[k] = input[k];
        }
    }
    return output;
};
