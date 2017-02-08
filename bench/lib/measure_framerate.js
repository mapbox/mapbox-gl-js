'use strict';

module.exports = function measureFramerate(duration, callback) {
    const startTime = performance.now();
    let count = 0;

    requestAnimationFrame(function onAnimationFrame() {
        count++;
        if (performance.now() < startTime + duration) {
            requestAnimationFrame(onAnimationFrame);
        } else {
            const endTime = performance.now();
            callback(null, count / (endTime - startTime) * 1000);
        }
    });
};
