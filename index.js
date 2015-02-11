'use strict';

function constant(value) {
    return function() {
        return value;
    }
}

function interpolateNumber(a, b, t) {
    return (a * (1 - t)) + (b * t);
}

function interpolateArray(a, b, t) {
    var result = [];
    for (var i = 0; i < a.length; i++) {
        result[i] = interpolateNumber(a[i], b[i], t);
    }
    return result;
}

exports['interpolated'] = function(f) {
    if (!f.stops) {
        return constant(f);
    }

    var stops = f.stops,
        base = f.base || 1,
        interpolate = Array.isArray(stops[0][1]) ? interpolateArray : interpolateNumber;

    return function(z) {
        // find the two stops which the current z is between
        var low, high;

        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];

            if (stop[0] <= z) {
                low = stop;
            }

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

            return interpolate(low[1], high[1], t);

        } else if (low) {
            return low[1];

        } else if (high) {
            return high[1];
        }
    };
};

exports['piecewise-constant'] = function(f) {
    if (!f.stops) {
        return constant(f);
    }

    var stops = f.stops;

    return function(z) {
        for (var i = 0; i < stops.length; i++) {
            if (stops[i][0] > z) {
                return stops[i === 0 ? 0 : i - 1][1];
            }
        }

        return stops[stops.length - 1][1];
    }
};
