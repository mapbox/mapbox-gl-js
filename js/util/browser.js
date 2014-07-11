'use strict';

exports.frame = function(fn) {
    fn();
};

exports.timed = function(fn, dur, ctx) {
    fn.call(ctx, 1);
}

exports.devicePixelRatio = 1;
