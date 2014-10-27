'use strict';

// Should be idempotent.

var ref = require('mapbox-gl-style-spec/reference/v6');

function eachLayer(layer, callback) {
    for (var k in layer.layers) {
        callback(layer.layers[k]);
        eachLayer(layer.layers[k], callback);
    }
}

function eachStyle(layer, callback) {
    for (var k in layer) {
        if (k.indexOf('style') === 0) {
            callback(layer[k], k);
        }
    }
}

module.exports = function(style) {
    style.version = 6;

    eachLayer(style, function (layer) {
        eachStyle(layer, function(klass) {
            if (klass['line-offset']) {
                var w = klass['line-width'] ? klass['line-width'] : ref.class_line['line-width'].default;
                if (typeof w === 'string') w = style.constants[w];

                if (w && !w.stops) {
                    if (typeof klass['line-offset'] === 'number') {
                        klass['line-offset'] = klass['line-offset'] - w;
                    } else if (klass['line-offset'].stops) {
                        var stops = klass['line-offset'].stops;
                        for (var s in klass['line-offset'].stops) {
                            stops[s][1] = stops[s][1] - w;
                        }
                    }
                }
            }
            rename(klass, 'line-offset', 'line-gap-width');
        });

        rename(layer, 'min-zoom', 'minzoom');
        rename(layer, 'max-zoom', 'maxzoom');

        if (layer.filter && !Array.isArray(layer.filter)) {
            layer.filter = require('./v6-filter')(layer.filter);
        }
    });

    return style;
};

function rename(o, from, to) {
    if (from in o) {
        o[to] = o[from];
        delete o[from];
    }
}
