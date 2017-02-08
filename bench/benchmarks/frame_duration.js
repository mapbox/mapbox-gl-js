'use strict';

const Evented = require('../../src/util/evented');
const formatNumber = require('../lib/format_number');
const createMap = require('../lib/create_map');

const DURATION_MILLISECONDS = 1 * 5000;

const zooms = [4, 8, 11, 13, 15, 17];
const results = [];

module.exports = function(options) {
    // The goal of this benchmark is to measure the time it takes to run the cpu
    // part of rendering. While the gpu rendering happens asynchronously, sometimes
    // when the gpu falls behind the cpu commands synchronously wait for the gpu to catch up.
    // This ends up affecting the duration of the call on the cpu.
    //
    // Setting the devicePixelRatio to a small number makes the canvas very small.
    // This greatly reduces the amount of work the gpu needs to do and reduces the
    // impact the actual rendering has on this benchmark.
    window.devicePixelRatio = 1 / 16;

    const evented = new Evented();

    asyncSeries(zooms.length, runZoom, done);

    function runZoom(times, callback) {
        const index = zooms.length - times;

        measureFrameTime(options, zooms[index], (err_, result) => {
            results[index] = result;
            evented.fire('log', {
                message: `${formatNumber(result.sum / result.count * 10) / 10} ms, ${
                    formatNumber(result.countAbove16 / result.count * 100)}% > 16 ms at zoom ${zooms[index]}`
            });
            callback();
        });
    }

    function done() {
        let sum = 0;
        let count = 0;
        let countAbove16 = 0;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            sum += result.sum;
            count += result.count;
            countAbove16 += result.countAbove16;
        }
        evented.fire('end', {
            message: `${formatNumber(sum / count * 10) / 10} ms, ${formatNumber(countAbove16 / count * 100)}% > 16ms`,
            score: sum / count
        });
    }

    return evented;
};

function measureFrameTime(options, zoom, callback) {

    const map = createMap({
        width: 1024,
        height: 768,
        zoom: zoom,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/streets-v9'
    });

    map.on('load', () => {

        map.repaint = true;

        // adding a delay seems to make the results more consistent
        window.setTimeout(() => {
            let sum = 0;
            let count = 0;
            let countAbove16 = 0;
            const start = performance.now();

            map._realrender = map._render;
            map._render = function() {
                map._styleDirty = true;
                map._sourcesDirty = true;

                const frameStart = performance.now();
                map._realrender();
                const frameEnd = performance.now();
                const duration = frameEnd - frameStart;

                sum += duration;
                count++;
                if (duration >= 16) countAbove16++;

                if (frameEnd - start > DURATION_MILLISECONDS) {
                    map.repaint = false;
                    map.remove();
                    map.getContainer().remove();
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
        work(times, (err) => {
            if (err) callback(err);
            else asyncSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}
