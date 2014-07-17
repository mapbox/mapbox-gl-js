'use strict';

exports.frame = function(fn) {
    return setTimeout(fn, 0);
};

exports.cancelFrame = function(id) {
    return clearTimeout(id);
};

exports.timed = function(fn, dur, ctx) {
    fn.call(ctx, 1);
}

exports.supported = function () {
    return true;
}

exports.devicePixelRatio = 1;
exports.hardwareConcurrency = 8;
