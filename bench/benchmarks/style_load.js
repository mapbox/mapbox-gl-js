'use strict';

var util = require('../../js/util/util');
var Evented = require('../../js/util/evented');
var ajax = require('../../js/util/ajax');
var config = require('../../js/util/config');
var Style = require('../../js/style/style');
var formatNumber = require('../lib/format_number');
var accessToken = require('../lib/access_token');

module.exports = function() {
    config.ACCESS_TOKEN = accessToken;

    var evented = util.extend({}, Evented);

    var stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=' + accessToken;
    ajax.getJSON(stylesheetURL, function(err, json) {
        if (err) {
            return evented.fire('error', {error: err});
        }

        var timeSum = 0;
        var timeCount = 0;

        asyncTimesSeries(20, function(callback) {
            var timeStart = performance.now();
            new Style(json)
                .on('error', function(err) {
                    evented.fire('error', { error: err });
                })
                .on('load', function() {
                    var time = performance.now() - timeStart;
                    timeSum += time;
                    timeCount++;
                    callback();
                });
        }, function() {
            var timeAverage = timeSum / timeCount;
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
