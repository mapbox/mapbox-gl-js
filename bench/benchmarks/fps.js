'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');
var measureFramerate = require('../lib/measure_framerate');

var DURATION_MILLISECONDS = 5 * 1000;

module.exports = function(options) {
    var evented = util.extend({}, Evented);

    var map = options.createMap({
        width: 1024,
        height: 768,
        zoom: 5,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v9'
    });

    map.on('load', function() {
        map.repaint = true;

        evented.fire('log', {
            message: 'starting ' + formatNumber(DURATION_MILLISECONDS / 1000) + ' second test',
            color: 'dark'
        });

        measureFramerate(DURATION_MILLISECONDS, function(err, fps) {
            if (err) {
                evented.fire('error', { error: err });
            } else {
                evented.fire('end', {
                    message: formatNumber(fps) + ' frames per second',
                    score: 1 / fps
                });
            }
        });
    });

    return evented;
};
