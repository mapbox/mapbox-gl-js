'use strict';

exports.frame = function(fn) {
    return setTimeout(fn, 0);
};

exports.cancelFrame = function(id) {
    return clearTimeout(id);
};

exports.timed = function(fn, dur, ctx) {
    if (!dur) {
        fn.call(ctx, 1);
        return null;
    }

    var abort = false,
        start = Date.now();

    function tick(now) {
        if (abort) return;
        now = Date.now();

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
