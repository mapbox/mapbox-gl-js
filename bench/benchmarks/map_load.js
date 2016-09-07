'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');
var createMap = require('../lib/create_map');

module.exports = function() {
    var evented = util.extend({}, Evented);

    var mapsOnPage = 6;

    evented.fire('log', { message: 'Creating ' + mapsOnPage + ' maps' });

    var loaded = 0;
    var maps = [];
    var start = Date.now();
    for (var i = 0; i < mapsOnPage; i++) {
        var map = maps[i] = createMap({
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
            for (var i = 0; i < maps.length; i++) {
                maps[i].remove();
            }
            evented.fire('end', {
                message: formatNumber(duration) + ' ms',
                score: duration
            });
            done();
        }
    }

    function done () {
    }

    return evented;
};
