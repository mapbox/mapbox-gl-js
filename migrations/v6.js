'use strict';
var ref = require('mapbox-gl-style-spec/reference/v6');

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
                if (klass['line-offset']) {
                    var w = klass['line-width'] ? klass['line-width'] : ref['class_line']['line-width'].default;
                    if (typeof w === 'string') w = style.constants[w];

                    if (w && !w.stops) {
                        if (typeof klass['line-offset'] === 'number') {
                            klass['line-offset'] = klass['line-offset'] - w;
                        } else if (klass['line-offset'].stops) {
                            var stops = klass['line-offset'].stops;
                            for (var s in klass['line-offset'].stops) {
                                stops[s] = stops[s] - w;
                            }
                        }
                    }

                }
                rename(klass, 'line-offset', 'line-gap-width');


            }
        }

        rename(layer, 'min-zoom', 'minzoom');
        rename(layer, 'max-zoom', 'maxzoom');

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
