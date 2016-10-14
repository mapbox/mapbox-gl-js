'use strict';

const util = require('../../js/util/util');
const Evented = require('../../js/util/evented');
const ajax = require('../../js/util/ajax');
const config = require('../../js/util/config');
const Style = require('../../js/style/style');
const formatNumber = require('../lib/format_number');
const accessToken = require('../lib/access_token');

module.exports = function() {
    config.ACCESS_TOKEN = accessToken;

    const evented = util.extend({}, Evented);

    const stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=' + accessToken;
    ajax.getJSON(stylesheetURL, function(err, json) {
        if (err) {
            return evented.fire('error', {error: err});
        }

        let timeSum = 0;
        let timeCount = 0;

        asyncTimesSeries(20, function(callback) {
            const timeStart = performance.now();
            new Style(json)
                .on('error', function(err) {
                    evented.fire('error', { error: err });
                })
                .on('style.load', function() {
                    const time = performance.now() - timeStart;
                    timeSum += time;
                    timeCount++;
                    callback();
                });
        }, function() {
            const timeAverage = timeSum / timeCount;
            evented.fire('end', {
                message: formatNumber(timeAverage) + ' ms',
                score: timeAverage
            });
        });
    });

    return evented;
};

function asyncTimesSeries(times, work, callback) {
    if (times > 0) {
        work(function(err) {
            if (err) callback(err);
            else asyncTimesSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}
