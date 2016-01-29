'use strict';

var Canvas = require('./canvas');

var frame = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

exports.frame = function(fn) {
    return frame(fn);
};

var cancel = window.cancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.msCancelAnimationFrame;

exports.cancelFrame = function(id) {
    cancel(id);
};

exports.timed = function (fn, dur, ctx) {
    if (!dur) {
        fn.call(ctx, 1);
        return null;
    }

    var abort = false,
        start = window.performance ? window.performance.now() : Date.now();

    function tick(now) {
        if (abort) return;
        if (!window.performance) now = Date.now();

        if (now >= start + dur) {
            fn.call(ctx, 1);
        } else {
            fn.call(ctx, (now - start) / dur);
            exports.frame(tick);
        }
    }

    exports.frame(tick);

    return function() { abort = true; };
};

exports.supportsWebGL = {};

/**
 * Test whether the basic JavaScript and DOM features required for Mapbox GL are present.
 * @param {Object} options
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the implementation determines that the performance of the created WebGL context would be dramatically lower than expected.
 * @return {boolean} Returns true if Mapbox GL should be expected to work, and false if not.
 * @memberof mapboxgl
 * @static
 */
exports.supported = function(options) {

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
            return !!(Function.prototype && Function.prototype.bind) &&
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
            var opt = (options && options.failIfMajorPerformanceCaveat) || false,
                fimpc = 'fimpc_' + String(opt);
            if (exports.supportsWebGL[fimpc] === undefined) {
                var canvas = new Canvas();
                exports.supportsWebGL[fimpc] = canvas.supportsWebGLContext(opt);
            }
            return exports.supportsWebGL[fimpc];
        },

        function() { return 'Worker' in window; }
    ];

    for (var i = 0; i < supports.length; i++) {
        if (!supports[i]()) return false;
    }
    return true;
};

exports.hardwareConcurrency = navigator.hardwareConcurrency || 8;

Object.defineProperty(exports, 'devicePixelRatio', {
    get: function() { return window.devicePixelRatio; }
});

exports.supportsWebp = false;

var webpImgTest = document.createElement('img');
webpImgTest.onload = function() {
    exports.supportsWebp = true;
};
webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
