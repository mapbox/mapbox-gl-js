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

function resolveConstant(style, value) {
    if (typeof value === 'string' && value[0] === '@') {
        return resolveConstant(style, style.constants[value]);
    } else {
        return value;
    }
}

function eachProperty(style, options, callback) {
    if (arguments.length === 2) {
        callback = options;
        options = {};
    }

    options.layout = options.layout === undefined ? true : options.layout;
    options.paint = options.paint === undefined ? true : options.paint;

    function inner(layer, properties) {
        Object.keys(properties).forEach(function(key) {
            callback({
                key: key,
                value: properties[key],
                set: function(x) {
                    properties[key] = x;
                }
            });
        });
    }

    eachLayer(style, function(layer) {
        if (options.paint) {
            eachPaint(layer, function(paint) {
                inner(layer, paint);
            });
        }
        if (options.layout) {
            eachLayout(layer, function(layout) {
                inner(layer, layout);
            });
        }
    });
}

function isFunction(value) {
    return Array.isArray(value.stops);
}

function renameProperty(obj, from, to) {
    obj[to] = obj[from]; delete obj[from];
}

module.exports = function(style) {
    style.version = 8;

    // Rename properties, reverse coordinates in source and layers
    eachSource(style, function(source) {
        if (source.type === 'video' && source.url !== undefined) {
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
            if (paint['fill-image'] !== undefined) {
                renameProperty(paint, 'fill-image', 'fill-pattern');
            }
        });
    });

    // Inline Constants
    eachProperty(style, function(property) {
        var value = resolveConstant(style, property.value);

        if (isFunction(value)) {
            value.stops.forEach(function(stop) {
                stop[1] = resolveConstant(style, stop[1]);
            });
        }

        property.set(value);
    });
    delete style.constants;

    function migrateFontStack(font) {
        function splitAndTrim(string) {
            return string.split(',').map(function(s) {
                return s.trim();
            });
        }

        if (Array.isArray(font)) {
            // Assume it's a previously migrated font-array.
            return font;

        } else if (typeof font === 'string') {
            return splitAndTrim(font);

        } else if (typeof font === 'object') {
            font.stops.forEach(function(stop) {
                stop[1] = splitAndTrim(stop[1]);
            });
            return font;

        } else {
            throw new Error("unexpected font value");
        }
    }

    eachLayer(style, function(layer) {
        eachLayout(layer, function(layout) {
            if (layout['text-font']) {
                layout['text-font'] = migrateFontStack(layout['text-font']);
            }
        });
    });

    return style;
};
