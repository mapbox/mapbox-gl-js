'use strict';

const Evented = require('../../src/util/evented');
const ajax = require('../../src/util/ajax');
const config = require('../../src/util/config');
const Style = require('../../src/style/style');
const formatNumber = require('../lib/format_number');
const accessToken = require('../lib/access_token');

module.exports = function() {
    config.ACCESS_TOKEN = accessToken;

    const evented = new Evented();

    const stylesheetURL = `https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`;
    ajax.getJSON(stylesheetURL, (err, json) => {
        if (err) {
            return evented.fire('error', {error: err});
        }

        let timeSum = 0;
        let timeCount = 0;

        asyncTimesSeries(20, (callback) => {
            const timeStart = performance.now();
            new Style(json)
                .on('error', (err) => {
                    evented.fire('error', { error: err });
                })
                .on('style.load', () => {
                    const time = performance.now() - timeStart;
                    timeSum += time;
                    timeCount++;
                    callback();
                });
        }, () => {
            const timeAverage = timeSum / timeCount;
            evented.fire('end', {
                message: `${formatNumber(timeAverage)} ms`,
                score: timeAverage
            });
        });
    });

    return evented;
};

function asyncTimesSeries(times, work, callback) {
    if (times > 0) {
        work((err) => {
            if (err) callback(err);
            else asyncTimesSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}
