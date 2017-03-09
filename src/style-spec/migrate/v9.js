'use strict';

const deref = require('../deref');

function eachLayer(style, callback) {
    for (const k in style.layers) {
        callback(style.layers[k]);
    }
}

module.exports = function(style) {
    style.version = 9;

    // remove user-specified refs
    style.layers = deref(style.layers);

    // remove class-specific paint properties
    eachLayer(style, (layer) => {
        for (const k in layer) {
            if (/paint\..*/.test(k)) {
                delete layer[k];
            }
        }
    });

    return style;
};
