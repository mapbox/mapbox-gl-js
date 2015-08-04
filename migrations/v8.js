'use strict';

var ref = require('../reference/v8');
var parseCSSColor = require('csscolorparser').parseCSSColor;

function getProperty(prop) {
    for (var i = 0; i < ref.layout.length; i++) {
        for (var key in ref[ref.layout[i]]) {
            if (key === prop) return ref[ref.layout[i]][key];
        }
    }
    for (i = 0; i < ref.paint.length; i++) {
        for (key in ref[ref.paint[i]]) {
            if (key === prop) return ref[ref.paint[i]][key];
        }
    }
}

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

    function migrateFontStack(font) {
        function splitAndTrim(string) {
            return string.split(',').map(function(s) {
                return s.trim();
            });
        }

        if (Array.isArray(font)) {
            // Assume it's a previously migrated font-array.
            return font;

        } else if (typeof font === 'string' && font[0] === '@') {
            style.constants[font] = migrateFontStack(style.constants[font]); // Recurse for functions
            return font;

        } else if (typeof font === 'string') {
            return splitAndTrim(font);

        } else if (typeof font === 'object') {
            font.stops.forEach(function(stop) {
                stop[1] = migrateFontStack(stop[1]); // Recurse for constants
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

    function findConstant(key, val, constants, arrayValue, callback) {
        if (typeof val === 'string' && val[0] === '@') {
            if (!(val in constants)) {
                throw new Error(key, val, 'constant "%s" not found', val);
            }
            var type = arrayValue ? getProperty(key).value : null;
            callback(key, val, type);
        }
    }

    function eachConstantReference(obj, constants, callback) {
        Object.keys(obj).forEach(function(key) {
            var val = obj[key];
            if (Array.isArray(val)) {
                for (var i in val) {
                    findConstant(key, val[i], constants, true, callback);
                }
            } else if (typeof val === 'object' && !/-transition$/.test(key)) {
                val.stops.forEach(function(stop) {
                    findConstant(key, stop[1], constants, false, callback);
                });
            }
            findConstant(key, val, constants, false, callback);
        });
    }

    eachLayer(style, function(layer) {
        eachLayout(layer, function(layout) {
            eachConstantReference(layout, style.constants, function(key, val, cType) {
                if (style.constants[val].type) return;
                style.constants[val] = {
                    type: cType || getProperty(key).type,
                    value: style.constants[val]
                };
            });
        });
        eachPaint(layer, function(paint) {
            eachConstantReference(paint, style.constants, function(key, val, cType) {
                if (style.constants[val].type) return;
                style.constants[val] = {
                    type: cType || getProperty(key).type,
                    value: style.constants[val]
                };
            });
        });
    });

    for (var k in style.constants) {
        if (!(typeof style.constants[k] === 'object' && style.constants[k].type)) {
            // infer simplest types
            if (typeof style.constants[k] === 'string' && parseCSSColor(style.constants[k])) {
                style.constants[k] = {
                    type: 'color',
                    value: style.constants[k]
                };
            } else {
                delete style.constants[k];
            }
        }
    }

    return style;
};
