'use strict';

module.exports = function(sourceCache, data, callback) {
    var sampleCount = 50;
    var startTime = null;
    var samples = [];

    sourceCache.on('data', function onData() {
        if (sourceCache.loaded()) {
            samples.push(performance.now() - startTime);
            sourceCache.off('data', onData);
            if (samples.length < sampleCount) {
                startTime = performance.now();
                sourceCache.clearTiles();
                sourceCache.on('data', onData);
                sourceCache.getSource().setData(data);
            } else {
                callback(null, average(samples));
            }
        }
    });

    startTime = performance.now();
    sourceCache.getSource().setData(data);
};

function average(array) {
    return array.reduce(function (sum, value) { return sum + value; }, 0) / array.length;
}
