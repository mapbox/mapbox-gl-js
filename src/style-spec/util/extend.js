'use strict';

module.exports = function (output) {
    for (let i = 1; i < arguments.length; i++) {
        const input = arguments[i];
        for (const k in input) {
            output[k] = input[k];
        }
    }
    return output;
};
