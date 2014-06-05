'use strict';

var UnitBezier = require('unitbezier');

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

var frameName = '';
if (typeof window !== 'undefined') {
    var frameName = (function() {
        if (window.requestAnimationFrame) return 'requestAnimationFrame';
        if (window.mozRequestAnimationFrame) return 'mozRequestAnimationFrame';
        if (window.webkitRequestAnimationFrame) return 'webkitRequestAnimationFrame';
        if (window.msRequestAnimationFrame) return 'msRequestAnimationFrame';
    })();
}

function frame(fn) {
    return window[frameName](fn);
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

var id = 1;

exports.uniqueId = function () {
    return id++;
};
