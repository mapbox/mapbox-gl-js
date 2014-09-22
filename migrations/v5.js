'use strict';

// Should be idempotent.

module.exports = function(style) {
    var k;

    style.version = 5;

    var sources = style.sources;
    for (k in sources) {
        var source = sources[k];
        rename(source, 'minZoom', 'minzoom');
        rename(source, 'maxZoom', 'maxzoom');

        if (source.url && !source.url.match(/^mapbox:\/\//)) {
            source.tiles = [source.url];
            delete source.url;
        }
    }

    var layers = style.layers;
    for (k in layers) {
        var layer = layers[k];

        for (var classname in layer) {
            if (classname.indexOf('style') === 0) {
                var klass = layer[classname];
                rename(klass, 'raster-fade', 'raster-fade-duration');

                for (var p in klass) {
                    var match = p.match(/^transition-(.*)$/);
                    if (match) {
                        rename(klass, match[0], match[1] + '-transition');
                    }
                }
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
