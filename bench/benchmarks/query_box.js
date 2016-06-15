'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');

var width = 1024;
var height = 768;

var numSamples = 10;

var zoomLevels = [];
for (var i = 4; i < 19; i++) {
    zoomLevels.push(i);
}

module.exports = function(options) {
    var evented = util.extend({}, Evented);

    var sum = 0;
    var count = 0;

    asyncSeries(zoomLevels.length, function(n, callback) {
        var zoomLevel = zoomLevels[zoomLevels.length - n];
        var map = options.createMap({
            width: width,
            height: height,
            zoom: zoomLevel,
            center: [-77.032194, 38.912753],
            style: 'mapbox://styles/mapbox/streets-v9'
        });
        document.getElementById('map').style.display = 'none';

        map.on('load', function() {

            var zoomSum = 0;
            var zoomCount = 0;
            asyncSeries(numSamples, function(n, callback) {
                var start = performance.now();
                map.queryRenderedFeatures();
                var duration = performance.now() - start;
                sum += duration;
                count++;
                zoomSum += duration;
                zoomCount++;
                callback();
            }, function() {
                evented.fire('log', {
                    message: 'zoom ' + zoomLevel + ' average: ' + (zoomSum / zoomCount).toFixed(2) + ' ms'
                });
                callback();
            });
        });
    }, done);


    function done() {
        var average = sum / count;
        evented.fire('end', {
            message: (average).toFixed(2) + ' ms',
            score: average
        });
    }
    setTimeout(function() {
        evented.fire('log', {
            message: 'loading assets',
            color: 'dark'
        });
    }, 0);

    return evented;
};

function asyncSeries(times, work, callback) {
    if (times > 0) {
        work(times, function(err) {
            if (err) callback(err);
            else asyncSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}

