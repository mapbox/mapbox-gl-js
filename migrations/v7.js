'use strict';

var ref = require('mapbox-gl-style-spec/reference/v7');

function eachLayer(layer, callback) {
    for (var k in layer.layers) {
        callback(layer.layers[k]);
        eachLayer(layer.layers[k], callback);
    }
}

function eachPaint(layer, callback) {
    for (var k in layer) {
        if (k.indexOf('paint') === 0) {
            callback(layer[k], k);
        }
    }
}


module.exports = function(style) {
    style.version = 7;

    var processedConstants = {};

    eachLayer(style, function(layer) {

        var round = layer.layout && layer.layout['line-cap'] === 'round';

        eachPaint(layer, function(paint) {
            if (paint['line-dasharray']) {
                var w = paint['line-width'] ? paint['line-width'] : ref.class_line['line-width'].default;
                if (typeof w === 'string') w = style.constants[w];

                var dasharray = paint['line-dasharray'];
                if (typeof dasharray === 'string') {
                    // don't process a constant more than once
                    if (processedConstants[dasharray]) return;
                    processedConstants[dasharray] = true;

                    dasharray = style.constants[dasharray];
                }

                if (typeof dasharray[0] === 'string') {
                    dasharray[0] = style.constants[dasharray[0]];
                }
                if (typeof dasharray[1] === 'string') {
                    dasharray[1] = style.constants[dasharray[1]];
                }

                var widthFn = parseNumber(w);
                var dashFn = parseNumberArray(dasharray);

                // since there is no perfect way to convert old functions,
                // just use the values at z17 to make the new value.
                var zoom = 17;

                var width = typeof widthFn === 'function' ? widthFn(zoom) : widthFn;
                var dash = dashFn(zoom);

                dash[0] /= width;
                dash[1] /= width;

                if (round) {
                    dash[0] -= 1;
                    dash[1] += 1;
                }

                if (typeof paint['line-dasharray'] === 'string') {
                    style.constants[paint['line-dasharray']] = dash;
                } else {
                    paint['line-dasharray'] = dash;
                }
            }
        });
    });

    return style;
};

// from mapbox-gl-js/js/style/style_declaration.js

function parseNumberArray(array) {
    var widths = array.map(parseNumber);

    return function(z) {
        var result = [];
        for (var i = 0; i < widths.length; i++) {
            result.push(typeof widths[i] === 'function' ? widths[i](z) : widths[i]);
        }
        return result;
    };
}


function parseNumber(num) {
    if (num.stops) num = stopsFn(num);
    var value = +num;
    return !isNaN(value) ? value : num;
}


function stopsFn(params) {
    var stops = params.stops;
    var base = params.base || ref.function.base.default;

    return function(z) {

        // find the two stops which the current z is between
        var low, high;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            if (stop[0] <= z) low = stop;
            if (stop[0] > z) {
                high = stop;
                break;
            }
        }

        if (low && high) {
            var zoomDiff = high[0] - low[0],
                zoomProgress = z - low[0],

                t = base === 1 ?
                    zoomProgress / zoomDiff :
                    (Math.pow(base, zoomProgress) - 1) / (Math.pow(base, zoomDiff) - 1);

            return interp(low[1], high[1], t);

        } else if (low) {
            return low[1];

        } else if (high) {
            return high[1];

        } else {
            return 1;
        }
    };
}

function interp(a, b, t) {
    return (a * (1 - t)) + (b * t);
}

