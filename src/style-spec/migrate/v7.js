'use strict';

const ref = require('../reference/v7.json');

function eachLayer(layer, callback) {
    for (const k in layer.layers) {
        callback(layer.layers[k]);
        eachLayer(layer.layers[k], callback);
    }
}

function eachPaint(layer, callback) {
    for (const k in layer) {
        if (k.indexOf('paint') === 0) {
            callback(layer[k], k);
        }
    }
}


// dash migrations are only safe to run once per style
const MIGRATE_DASHES = false;

const vec2props = {
    "fill-translate": true,
    "line-translate": true,
    "icon-offset": true,
    "text-offset": true,
    "icon-translate": true,
    "text-translate": true
};


module.exports = function(style) {
    style.version = 7;

    const processedConstants = {};

    eachLayer(style, (layer) => {

        const round = layer.layout && layer.layout['line-cap'] === 'round';

        eachPaint(layer, (paint) => {


            // split raster brightness
            if (paint['raster-brightness']) {
                let bval = paint['raster-brightness'];
                if (typeof bval === 'string') bval = style.constants[bval];
                paint['raster-brightness-min'] = typeof bval[0] === 'string' ? style.constants[bval[0]] : bval[0];
                paint['raster-brightness-max'] = typeof bval[1] === 'string' ? style.constants[bval[1]] : bval[1];
                delete paint['raster-brightness'];
            }



            // Migrate vec2 prop functions
            for (const vec2prop in vec2props) {
                const val = paint[vec2prop];
                if (val && Array.isArray(val)) {
                    let s = val[0];
                    let t = val[1];

                    if (typeof s === 'string') {
                        s = style.constants[s];
                    }
                    if (typeof t === 'string') {
                        t = style.constants[t];
                    }

                    // not functions, nothing to migrate
                    if (s === undefined || t === undefined) continue;
                    if (!s.stops && !t.stops) continue;

                    const stopZooms = [];
                    let base;
                    if (s.stops) {
                        for (let i = 0; i < s.stops.length; i++) {
                            stopZooms.push(s.stops[i][0]);
                        }
                        base = s.base;
                    }
                    if (t.stops) {
                        for (let k = 0; k < t.stops.length; k++) {
                            stopZooms.push(t.stops[k][0]);
                        }
                        base = base || t.base;
                    }
                    stopZooms.sort();

                    const fn = parseNumberArray([s, t]);

                    const newStops = [];
                    for (let h = 0; h < stopZooms.length; h++) {
                        const z = stopZooms[h];
                        if (z === stopZooms[h - 1]) continue;
                        newStops.push([z, fn(z)]);
                    }

                    paint[vec2prop] = { stops: newStops };
                    if (base) {
                        paint[vec2prop].base = base;
                    }
                }
            }



            if (paint['line-dasharray'] && MIGRATE_DASHES) {
                let w = paint['line-width'] ? paint['line-width'] : ref.class_line['line-width'].default;
                if (typeof w === 'string') w = style.constants[w];

                let dasharray = paint['line-dasharray'];
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

                const widthFn = parseNumber(w);
                const dashFn = parseNumberArray(dasharray);

                // since there is no perfect way to convert old functions,
                // just use the values at z17 to make the new value.
                const zoom = 17;

                const width = typeof widthFn === 'function' ? widthFn(zoom) : widthFn;
                const dash = dashFn(zoom);

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

    style.layers = style.layers.filter((layer) => {
        return !layer.layers;
    });

    return style;
};

// from mapbox-gl-js/src/style/style_declaration.js

function parseNumberArray(array) {
    const widths = array.map(parseNumber);

    return function(z) {
        const result = [];
        for (let i = 0; i < widths.length; i++) {
            result.push(typeof widths[i] === 'function' ? widths[i](z) : widths[i]);
        }
        return result;
    };
}


function parseNumber(num) {
    if (num.stops) num = stopsFn(num);
    const value = +num;
    return !isNaN(value) ? value : num;
}


function stopsFn(params) {
    const stops = params.stops;
    const base = params.base || ref.function.base.default;

    return function(z) {

        // find the two stops which the current z is between
        let low, high;

        for (let i = 0; i < stops.length; i++) {
            const stop = stops[i];
            if (stop[0] <= z) low = stop;
            if (stop[0] > z) {
                high = stop;
                break;
            }
        }

        if (low && high) {
            const zoomDiff = high[0] - low[0];
            const zoomProgress = z - low[0];
            const t = base === 1 ?
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
