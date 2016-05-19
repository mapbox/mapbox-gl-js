'use strict';

/*
 * When browserify builds Mapbox GL JS, it redirects all require() statements
 * from this file, js/util/browser.js, to js/util/browser/browser.js.
 * The latter relies on running in a real browser: 'window' must be defined,
 * as well as other browser-specific globals. This file, on the other hand,
 * is comfortable running under node.js, which is why it's the default require:
 * it's used for tests.
 */

var window = {
    addEventListener: function() {},
    removeEventListener: function() {}
};

exports.window = window;

exports.frame = function(fn) {
    return setImmediate(fn);
};

exports.cancelFrame = function(id) {
    return clearImmediate(id);
};

module.exports.now = Date.now.bind(Date);

exports.timed = function(fn, dur, ctx) {
    if (!dur) {
        fn.call(ctx, 1);
        return null;
    }

    var abort = false,
        start = module.exports.now();

    function tick(now) {
        if (abort) return;
        now = module.exports.now();

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

exports.supported = function () {
    return true;
};

exports.devicePixelRatio = 1;
exports.hardwareConcurrency = 8;
exports.supportsWebp = false;
exports.supportsGeolocation = false;
