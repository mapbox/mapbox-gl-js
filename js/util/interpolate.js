'use strict';

module.exports = interpolate;

function interpolate(a, b, t) {
    return (a * (1 - t)) + (b * t);
}

interpolate.number = interpolate;

interpolate.vec2 = function(from, to, t) {
    return [
        interpolate(from[0], to[0], t),
        interpolate(from[1], to[1], t)
    ];
};

interpolate.color = function(from, to, t) {
    return [
        interpolate(from[0], to[0], t),
        interpolate(from[1], to[1], t),
        interpolate(from[2], to[2], t),
        interpolate(from[3], to[3], t)
    ];
};

interpolate.array = function(from, to, t) {
    return from.map(function(d, i) {
        return interpolate(d, to[i], t);
    });
};
