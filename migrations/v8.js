'use strict';

var ref = require('../reference/v8'),
    parseCSSColor = require('csscolorparser').parseCSSColor;

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
            if (typeof layout['text-font'] === 'string') {
                if (layout['text-font'][0] === '@') {
                    // if the text-font is actually a reference, mutate
                    // the constant, not the @constant reference
                    style.constants[layout['text-font']] = style.constants[layout['text-font']].split(',')
                        .map(function(s) {
                            return s.trim();
                        });
                } else {
                    layout['text-font'] = layout['text-font'].split(',')
                        .map(function(s) {
                            return s.trim();
                        });
                }
            }
            if (layout['symbol-min-distance'] !== undefined) renameProperty(layout, 'symbol-min-distance', 'symbol-spacing');
        });
        eachPaint(layer, function(paint) {
            if (paint['background-image'] !== undefined) renameProperty(paint, 'background-image', 'background-pattern');
            if (paint['line-image'] !== undefined) renameProperty(paint, 'line-image', 'line-pattern');
            if (paint['fill-image'] !== undefined) renameProperty(paint, 'fill-image', 'fill-pattern');
        });
    });

    function findConstant(key, val, constants, nested, callback) {
        if (typeof val === 'string' && val[0] === '@') {
            if (!(val in constants)) {
                throw new Error(key, val, 'constant "%s" not found', val);
            }
            var type = nested ? getProperty(key).value : null;
            callback(key, val, type);
        }
    }

    function eachConstantReference(obj, constants, callback) {
        for (var key in obj) {
            var val = obj[key];
            if (Array.isArray(val)) {
                val.forEach(function(v) {
                    findConstant(key, v, constants, true, callback);
                });
            }
            findConstant(key, val, constants, false, callback);
        }
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
