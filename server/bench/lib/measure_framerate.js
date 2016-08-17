'use strict';

module.exports = function measureFramerate(duration, callback) {
    var startTime = performance.now();
    var count = 0;

    requestAnimationFrame(function onAnimationFrame() {
        count++;
        if (performance.now() < startTime + duration) {
            requestAnimationFrame(onAnimationFrame);
        } else {
            var endTime = performance.now();
            callback(null, count / (endTime - startTime) * 1000);
        }
    });
};
