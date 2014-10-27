'use strict';

// Should be idempotent.

module.exports = function(style) {
    var k;

    style.version = 6;

    var layers = style.layers;
    for (k in layers) {
        var layer = layers[k];

        for (var classname in layer) {
            if (classname.indexOf('style') === 0) {
                var klass = layer[classname];
                rename(klass, 'line-offset', 'line-gap-width');
                if (klass['line-gap-width']) {
                    if (typeof klass['line-gap-width'] === 'number') {
                        klass['line-gap-width'] = klass['line-gap-width'] - klass['line-width'];
                    } else if (klass['line-gap-width'].stops) {
                        var stops = klass['line-gap-width'].stops;
                        for (var s in klass['line-gap-width'].stops) {
                            stops[s] = stops[s] - klass['line-width'];
                        }
                    }
                }
            }
        }

        if (layer.filter) {
            layer.filter = require('./v6-filter')(layer.filter);
        }
    }

    return style;
};

function rename(o, from, to) {
    if (from in o) {
        o[to] = o[from];
        delete o[from];
    }
}
