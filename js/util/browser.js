'use strict';

exports.frame = function(fn) {
    fn();
};

exports.timed = function(fn, dur, ctx) {
    fn.call(ctx, 1);
}

exports.getJSON = function (url, callback) {
    // TODO
};

exports.getArrayBuffer = function (url, callback) {
    // TODO
};

exports.supported = function () {
    return true;
}

exports.devicePixelRatio = 1;
exports.hardwareConcurrency = 8;
