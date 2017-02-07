'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');
var setDataPerf = require('../lib/set_data_perf');
var setupGeoJSONMap = require('../lib/setup_geojson_map');
var createMap = require('../lib/create_map');
var ajax = require('../../js/util/ajax');

module.exports = function() {
    var evented = util.extend({}, Evented);

    setTimeout(function() {
        evented.fire('log', {message: 'downloading large geojson'});
    }, 0);

    ajax.getJSON('http://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson', function(err, data) {
        evented.fire('log', {message: 'starting test'});

        if (err) return evented.fire('error', {error: err});

        var map = createMap({
            width: 1024,
            height: 768,
            zoom: 5,
            center: [-77.032194, 38.912753],
            style: 'mapbox://styles/mapbox/bright-v9'
        });

        map.on('load', function() {
            map = setupGeoJSONMap(map);

            setDataPerf(map.style.sourceCaches.geojson, data, function(err, ms) {
                if (err) return evented.fire('error', {error: err});
                map.remove();
                evented.fire('end', {message: formatNumber(ms) + ' ms', score: ms});
            });
        });
    });

    return evented;
};
