'use strict';

var UnitBezier = require('../lib/unitbezier.js');

// Rotate a vector (multiply the rotation transformation matrix by the vector).
exports.rotate = function rotate(a, v) { return { x: Math.cos(a) * v.x - Math.sin(a) * v.y, y: Math.sin(a) * v.x + Math.cos(a) * v.y }; };

// Subtract vector b from vector a.
exports.vectorSub = function vectorSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; };

// Add vectors a and b.
exports.vectorAdd = function vectorAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; };

// Take the magnitude of vector a.
exports.vectorMag = function vectorMag(a) { return Math.sqrt(a.x * a.x + a.y * a.y); };

// Find the angle of the two vectors. In this particular instance, I solve the formula for the
// cross product a x b = |a||b|sin(θ) for θ.
//exports.angleBetween = function angleBetween(a, b) { return Math.asin((a.x * b.y - a.y * b.x) / (exports.vectorMag(a) * exports.vectorMag(b))); }
exports.angleBetween = function angleBetween(a, b) { return Math.atan2((a.x * b.y - a.y * b.x), exports.dot(a, b)); };
exports.angleBetweenSep = function angleBetween(ax, ay, bx, by) { return Math.atan2((ax * by - ay * bx), ax * bx + ay * by); };

exports.vectorMul = function vectorMul(m, v) {
    return { x: m.a * v.x + m.b * v.y, y: m.c * v.x + m.d * v.y };
};

exports.vectorScalMul = function vectorScalMul(t, m) {
    return { x: t * m.x, y: t * m.y };
};

exports.dot = function dot(a, b) {
    return a.x * b.x + a.y * b.y;
};

exports.distance_squared = function distance_squared(a, b) {
    var p = a.x - b.x;
    var q = a.y - b.y;
    return p*p + q*q;
};

var PI_2 = Math.PI / 2;

exports.clamp_horizontal = function clamp_horizontal(angle) {
    return (angle + PI_2) % Math.PI - PI_2;
};

exports.line_center = function line_center(a, b) {
    return { x: a.x + (b.x - a.x) / 2, y: a.y + (b.y - a.y) / 2 };
};

exports.unit = function unit(v) {
    var mag = exports.vectorMag(v);
    return { x: v.x/mag, y: v.y/mag };
};

exports.normal = function normal(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var c = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / c, y: dy / c };
};

exports.dist = function dist(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var c = Math.sqrt(dx * dx + dy * dy);
    return c;
};

exports.easeCubicInOut = function easeCubicInOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  var t2 = t * t, t3 = t2 * t;
  return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
};

exports.bezier = function(p1x, p1y, p2x, p2y) {
    var bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return function(t) {
        return bezier.solve(t);
    };
};

exports.ease = exports.bezier(0.25, 0.1, 0.25, 1);

exports.frame = frame;
function frame(fn) {
    return (window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame)(fn);
}

exports.timed = function timed(fn, dur) {
    var start =  window.performance ?
        window.performance.now() : Date.now(),
        abort = false,
        till = start + dur;

    function tick(now) {
        if (!window.performance) now = Date.now();
        if (abort) return;
        if (now > till) return fn(1);
        fn((now - start) / dur);
        frame(tick);
    }

    frame(tick);

    return function() {
        abort = true;
    };
};

exports.interp = function interp(a, b, t) {
    return (a * (1 - t)) + (b * t);
};

exports.async_each = function async_each(array, fn, callback) {
    var remaining = array.length;
    if (remaining === 0) return callback();
    function check() { if (--remaining === 0) callback(); }
    for (var i = 0; i < array.length; i++) fn(array[i], check);
};

exports.unique = function unique(arr) {
    return arr.filter(function(el, i) {
        return arr.indexOf(el) === i;
    });
};

exports.difference = function difference(arr, other) {
    return arr.filter(function(el) {
        return other.indexOf(el) < 0;
    });
};

exports.pluck = function pluck(arr, prop) {
    return arr.map(function(el) {
        return el[prop];
    });
};

exports.values = function (obj) {
    var values = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            values.push(obj[key]);
        }
    }
    return values;
};

exports.clone = function clone(obj) {
    var result = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    }
    return result;
};

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
exports.deepFreeze = function deepFreeze(o) {
    var prop, propKey;
    Object.freeze(o); // First freeze the object.
    for (propKey in o) {
        prop = o[propKey];
        if (!o.hasOwnProperty(propKey) || typeof prop !== "object" || Object.isFrozen(prop)) {
            // If the object is on the prototype, not an object, or is already frozen,
            // skip it. Note that this might leave an unfrozen reference somewhere in the
            // object if there is an already frozen object containing an unfrozen object.
            continue;
        }

        deepFreeze(prop); // Recursively call deepFreeze.
    }
};

// formats a number with a certain amount of decimals, correct rounding and omitting trailing zeros.
exports.formatNumber = function formatNumber(num, maxdecimals) {
    maxdecimals = +maxdecimals;
    if (typeof maxdecimals !== 'number') maxdecimals = 0;
    var factor = Math.pow(10, maxdecimals);
    return (Math.round(num * factor) / factor).toFixed(maxdecimals).replace(/\.?0+$/, '');
};
