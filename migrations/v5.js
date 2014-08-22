'use strict';

// Should be idempotent.

module.exports = function(style) {
    style.version = 5;

    var sources = style.sources;
    for (var k in sources) {
        var source = sources[k];
        rename(source, 'minZoom', 'minzoom');
        rename(source, 'maxZoom', 'maxzoom');

        if (source.url && !source.url.match(/^mapbox:\/\//)) {
            source.tiles = [source.url];
            delete source.url;
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
