'use strict';

var frameName = (function() {
    if (window.requestAnimationFrame) return 'requestAnimationFrame';
    if (window.mozRequestAnimationFrame) return 'mozRequestAnimationFrame';
    if (window.webkitRequestAnimationFrame) return 'webkitRequestAnimationFrame';
    if (window.msRequestAnimationFrame) return 'msRequestAnimationFrame';
})();

exports.frame = function(fn) {
    return window[frameName](fn);
};

exports.cancelFrame = function(id) {
    (window.cancelRequestAnimationFrame ||
        window.mozCancelRequestAnimationFrame ||
        window.webkitCancelRequestAnimationFrame ||
        window.msCancelRequestAnimationFrame)(id);
};

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
            exports.frame(tick);
        }
    }

    exports.frame(tick);

    return function() { abort = true; };
};

exports.supported = function() {
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

exports.hardwareConcurrency = navigator.hardwareConcurrency || 8;

Object.defineProperty(exports, 'devicePixelRatio', {
    get: function() { return window.devicePixelRatio; }
});
