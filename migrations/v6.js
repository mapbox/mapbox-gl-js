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
                // TODO reverse calculate offset difference -- account for fns etc
                // if (klass['line-gap-width']) {
                //     klass['line-gap-width'] = klass['line-gap-width'] - klass['line-width'];
                // }
            }
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
