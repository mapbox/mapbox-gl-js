'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');

module.exports = function(options) {
    var evented = util.extend({}, Evented);

    var mapsOnPage = 6;

    evented.fire('log', { message: 'Creating ' + mapsOnPage + ' maps' });

    var loaded = 0;
    var start = Date.now();
    for (var i = 0; i < mapsOnPage; i++) {
        var map = options.createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });
        map.on('load', onload.bind(null, map));
        map.on('error', function (err) {
            evented.fire('error', err);
        });
    }

    function onload () {
        if (++loaded >= mapsOnPage) {
            var duration = Date.now() - start;
            evented.fire('end', {
                message: formatNumber(duration) + ' ms, loaded ' + mapsOnPage + ' maps.',
                score: duration
            });
            done();
        }
    }

    function done () {
    }

    return evented;
};

