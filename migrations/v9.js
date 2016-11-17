'use strict';

var deref = require('../lib/deref');

function eachLayer(style, callback) {
    for (var k in style.layers) {
        callback(style.layers[k]);
    }
}

module.exports = function(style) {
    style.version = 9;

    // remove user-specified refs
    style.layers = deref(style.layers);

    // remove class-specific paint properties
    eachLayer(style, function (layer) {
        for (var k in layer) {
            if (/paint\..*/.test(k)) {
                delete layer[k];
            }
        }
    });

    return style;
};
