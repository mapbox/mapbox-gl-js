'use strict';

function eachSource(style, callback) {
    for (var k in style.sources) {
        callback(style.sources[k]);
    }
}

function eachLayer(style, callback) {
    for (var k in style.layers) {
        callback(style.layers[k]);
        eachLayer(style.layers[k], callback);
    }
}

function eachLayout(layer, callback) {
    for (var k in layer) {
        if (k.indexOf('layout') === 0) {
            callback(layer[k], k);
        }
    }
}

function eachPaint(layer, callback) {
    for (var k in layer) {
        if (k.indexOf('paint') === 0) {
            callback(layer[k], k);
        }
    }
}

function renameProperty(obj, from, to) {
    obj[to] = obj[from]; delete obj[from];
}

module.exports = function(style) {
    style.version = 8;

    eachSource(style, function(source) {
        if (source.type === 'video' &&
            source.url !== undefined) {
            renameProperty(source, 'url', 'urls');
        }
        if (source.type === 'video') {
            source.coordinates.forEach(function(coord) {
                return coord.reverse();
            });
        }
    });

    eachLayer(style, function(layer) {
        eachLayout(layer, function(layout) {
            if (typeof layout['text-font'] === 'string') {
                layout['text-font'] = layout['text-font'].split(',')
                    .map(function(s) {
                        return s.trim();
                    });
            }
            if (layout['symbol-min-distance'] !== undefined) {
                renameProperty(layout, 'symbol-min-distance', 'symbol-spacing');
            }
        });

        eachPaint(layer, function(paint) {
            if (paint['background-image'] !== undefined) {
                renameProperty(paint, 'background-image', 'background-pattern');
            }
            if (paint['line-image'] !== undefined) {
                renameProperty(paint, 'line-image', 'line-pattern');
            }
        });
    });

    return style;
};
