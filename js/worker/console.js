'use strict';

exports.log = exports.warn = function() {
    self.postMessage({ type: 'debug message', data: [].slice.call(arguments) });
};

exports._startTimes = {};

exports.time = function(n) {
    exports._startTimes[n] = (new Date()).getTime();
};

exports.timeEnd = function(n) {
    exports.log(n + ':', (new Date()).getTime() - exports._startTimes[n] + 'ms');
};
