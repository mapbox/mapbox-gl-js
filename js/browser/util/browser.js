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

exports.devicePixelRatio = window.devicePixelRatio;
