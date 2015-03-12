'use strict';

function eachLayer(layer, callback) {
    for (var k in layer.layers) {
        callback(layer.layers[k]);
        eachLayer(layer.layers[k], callback);
    }
}

function eachLayout(layer, callback) {
    for (var k in layer) {
        if (k.indexOf('layout') === 0) {
            callback(layer[k], k);
        }
    }
}

module.exports = function(style) {
    style.version = 8;

    eachLayer(style, function(layer) {
        eachLayout(layer, function(layout) {
            if (typeof layout['text-font'] === 'string') {
                layout['text-font'] = layout['text-font'].split(',')
                    .map(function(s) {
                        return s.trim();
                    });
            }
        });
    });

    return style;
};
