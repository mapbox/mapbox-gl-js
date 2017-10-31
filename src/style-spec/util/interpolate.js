// @flow

const Color = require('./color');

module.exports = interpolate;

function interpolate(a: number, b: number, t: number) {
    return (a * (1 - t)) + (b * t);
}

interpolate.number = interpolate;

interpolate.vec2 = function(from: [number, number], to: [number, number], t: number) {
    return [
        interpolate(from[0], to[0], t),
        interpolate(from[1], to[1], t)
    ];
};

interpolate.color = function(from: Color, to: Color, t: number) {
    return new Color(
        interpolate(from.r, to.r, t),
        interpolate(from.g, to.g, t),
        interpolate(from.b, to.b, t),
        interpolate(from.a, to.a, t)
    );
};

interpolate.array = function(from: Array<number>, to: Array<number>, t: number) {
    return from.map((d, i) => {
        return interpolate(d, to[i], t);
    });
};
