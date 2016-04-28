'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');

var DURATION_MILLISECONDS = 1 * 5000;

// The goal of this benchmark is to measure the time it takes to run the cpu
// part of rendering. While the gpu rendering happens asynchronously, sometimes
// when the gpu falls behind the cpu commands synchronously wait for the gpu to catch up.
// This ends up affecting the duration of the call on the cpu.
//
// Setting the devicePixelRatio to a small number makes the canvas very small.
// This greatly reduces the amount of work the gpu needs to do and reduces the
// impact the actual rendering has on this benchmark.
window.devicePixelRatio = 1 / 16;

var zooms = [4, 8, 11, 13, 15, 17];
var results = [];

module.exports = function(options) {
    var evented = util.extend({}, Evented);

    asyncSeries(zooms.length, runZoom, done);

    function runZoom(times, callback) {
        var index = zooms.length - times;

        measureFrameTime(options, zooms[index], function(err_, result) {
            results[index] = result;
            evented.fire('log', {
                message: formatNumber(result.sum / result.count * 10) / 10 + ' ms per frame at zoom ' + zooms[index] + '. ' +
                    formatNumber(result.countAbove16 / result.count * 100) + '% of frames took longer than 16ms.'
            });
            callback();
        });
    }

    function done() {
        document.getElementById('map').remove();

        var sum = 0;
        var count = 0;
        var countAbove16 = 0;
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            sum += result.sum;
            count += result.count;
            countAbove16 += result.countAbove16;
        }
        evented.fire('end', {
            message: formatNumber(sum / count * 10) / 10 + ' ms per frame. ' + formatNumber(countAbove16 / count * 100) + '% of frames took longer than 16ms.',
            score: sum / count
        });
    }

    return evented;
};

function measureFrameTime(options, zoom, callback) {

    var map = options.createMap({
        width: 1024,
        height: 768,
        zoom: zoom,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/streets-v8'
    });

    map.on('load', function() {

        map.repaint = true;

        // adding a delay seems to make the results more consistent
        window.setTimeout(function() {
            var sum = 0;
            var count = 0;
            var countAbove16 = 0;
            var start = performance.now();

            map._realrender = map._render;
            map._render = function() {
                map._styleDirty = true;
                map._sourcesDirty = true;

                var frameStart = performance.now();
                map._realrender();
                var frameEnd = performance.now();
                var duration = frameEnd - frameStart;

                sum += duration;
                count++;
                if (duration >= 16) countAbove16++;

                if (frameEnd - start > DURATION_MILLISECONDS) {
                    map.repaint = false;
                    map.remove();
                    callback(undefined, {
                        sum: sum,
                        count: count,
                        countAbove16: countAbove16
                    });
                }
            };
        }, 100);
    });
}

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

