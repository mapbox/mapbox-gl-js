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

exports.interp = function (a, b, t) {
    return (a * (1 - t)) + (b * t);
};

exports.premultiply = function (c) {
    c[0] *= c[3];
    c[1] *= c[3];
    c[2] *= c[3];
    return c;
};

exports.zoomTo = function(c, z) {
    c.column = c.column * Math.pow(2, z - c.zoom);
    c.row = c.row * Math.pow(2, z - c.zoom);
    c.zoom = z;
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

exports.getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            var data;
            try { data = JSON.parse(xhr.response); }
            catch (err) { return callback(err); }
            callback(null, data);
        } else {
            callback(new Error(xhr.statusText));
        }
    };
    xhr.send();
    return xhr;
};

exports.getArrayBuffer = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, xhr.response);
        } else {
            callback(new Error(xhr.statusText));
        }
    };
    xhr.send();
    return xhr;
};

module.exports.supported = function() {
    var supports = [

        function() { return typeof window !== 'undefined'; },

        function() { return typeof document !== 'undefined'; },

        function () {
            return !!(Array.prototype &&
              Array.prototype.every &&
              Array.prototype.filter &&
              Array.prototype.forEach &&
              Array.prototype.indexOf &&
              Array.prototype.lastIndexOf &&
              Array.prototype.map &&
              Array.prototype.some &&
              Array.prototype.reduce &&
              Array.prototype.reduceRight &&
              Array.isArray);
        },

        function() {
            return !!(Function.prototype && Function.prototype.bind),
                !!(Object.keys &&
                   Object.create &&
                   Object.getPrototypeOf &&
                   Object.getOwnPropertyNames &&
                   Object.isSealed &&
                   Object.isFrozen &&
                   Object.isExtensible &&
                   Object.getOwnPropertyDescriptor &&
                   Object.defineProperty &&
                   Object.defineProperties &&
                   Object.seal &&
                   Object.freeze &&
                   Object.preventExtensions);
        },

        function() {
            return 'JSON' in window && 'parse' in JSON && 'stringify' in JSON;
        },

        function() {
            var canvas = document.createElement('canvas');
            if ('supportsContext' in canvas) {
                return canvas.supportsContext('webgl') || canvas.supportsContext('experimental-webgl');
            }
            return !!window.WebGLRenderingContext;
        },

        function() { return 'Worker' in window; }
    ];

    for (var i = 0; i < supports.length; i++) {
        if (!supports[i]()) return false;
    }
    return true;
};
