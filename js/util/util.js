'use strict';

var UnitBezier = require('../lib/unitbezier.js');

// Rotate a vector (multiply the rotation transformation matrix by the vector).
exports.rotate = function (a, v) {
    var cos = Math.cos(a),
        sin = Math.sin(a);

    return {
        x: cos * v.x - sin * v.y,
        y: sin * v.x + cos * v.y
    };
};

// Subtract vector b from vector a.
exports.vectorSub = function (a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
};

// Add vectors a and b.
exports.vectorAdd = function (a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
};

exports.vectorMul = function (m, v) {
    return {
        x: m.a * v.x + m.b * v.y,
        y: m.c * v.x + m.d * v.y
    };
};

// Take the magnitude of vector a.
exports.vectorMag = function (a) {
    return Math.sqrt(a.x * a.x + a.y * a.y);
};

// Find the angle of the two vectors, solving the formula for the cross product a x b = |a||b|sin(θ) for θ.
exports.angleBetweenSep = function (ax, ay, bx, by) {
    return Math.atan2(
        ax * by - ay * bx,
        ax * bx + ay * by);
};
exports.angleBetween = function (a, b) {
    return exports.angleBetweenSep(a.x, a.y, b.x, b.y);
};

exports.normal = function (a, b) {
    var dx = b.x - a.x,
        dy = b.y - a.y,
        c = Math.sqrt(dx * dx + dy * dy);
    return {
        x: dx / c,
        y: dy / c
    };
};

exports.dist = function (a, b) {
    var dx = b.x - a.x,
        dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
};

exports.distSqr = function (a, b) {
    var dx = b.x - a.x,
        dy = b.y - a.y;
    return dx * dx + dy * dy;
};


exports.easeCubicInOut = function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var t2 = t * t,
        t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
};

exports.bezier = function(p1x, p1y, p2x, p2y) {
    var bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t) {
        return bezier.solve(t);
    };
};

exports.ease = exports.bezier(0.25, 0.1, 0.25, 1);


function frame(fn) {
    return (window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame)(fn);
}

exports.frame = frame;

exports.timed = function (fn, dur, ctx) {
    if (!dur) { return fn.call(ctx, 1); }

    var abort = false,
        start = window.performance ? window.performance.now() : Date.now();

    function tick(now) {
        if (abort) return;
        if (!window.performance) now = Date.now();

        if (now > start + dur) {
            fn.call(ctx, 1);
        } else {
            fn.call(ctx, (now - start) / dur);
            frame(tick);
        }
    }

    frame(tick);

    return function() { abort = true; };
};

exports.interp = function (a, b, t) {
    return (a * (1 - t)) + (b * t);
};

exports.premultiply = function (c) {
    c[0] *= c[3];
    c[1] *= c[3];
    c[2] *= c[3];
    return c;
};

exports.asyncEach = function (array, fn, callback) {
    var remaining = array.length;
    if (remaining === 0) return callback();
    function check() { if (--remaining === 0) callback(); }
    for (var i = 0; i < array.length; i++) fn(array[i], check);
};

exports.keysDifference = function (obj, other) {
    var difference = [];
    for (var i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
};

exports.extend = function (dest, src) {
    for (var i in src) {
        Object.defineProperty(dest, i, Object.getOwnPropertyDescriptor(src, i));
    }
    return dest;
};
