'use strict';

const Evented = require('../../src/util/evented');
const createMap = require('../lib/create_map');

const width = 1024;
const height = 768;

const numSamples = 10;

const zoomLevels = [];
for (let i = 4; i < 19; i++) {
    zoomLevels.push(i);
}

module.exports = function() {
    const evented = new Evented();

    let sum = 0;
    let count = 0;

    asyncSeries(zoomLevels.length, (n, callback) => {
        const zoomLevel = zoomLevels[zoomLevels.length - n];
        const map = createMap({
            width: width,
            height: height,
            zoom: zoomLevel,
            center: [-77.032194, 38.912753],
            style: 'mapbox://styles/mapbox/streets-v9'
        });
        map.getContainer().style.display = 'none';

        map.on('load', () => {

            let zoomSum = 0;
            let zoomCount = 0;
            asyncSeries(numSamples, (n, callback) => {
                const start = performance.now();
                map.queryRenderedFeatures({});
                const duration = performance.now() - start;
                sum += duration;
                count++;
                zoomSum += duration;
                zoomCount++;
                callback();
            }, () => {
                evented.fire('log', {
                    message: `${(zoomSum / zoomCount).toFixed(2)} ms at zoom ${zoomLevel}`
                });
                map.remove();
                callback();
            });
        });
    }, done);


    function done() {
        const average = sum / count;
        evented.fire('end', {
            message: `${(average).toFixed(2)} ms`,
            score: average
        });
    }
    setTimeout(() => {
        evented.fire('log', {
            message: 'loading assets',
            color: 'dark'
        });
    }, 0);

    return evented;
};

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
