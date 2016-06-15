'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');
var setDataPerf = require('../lib/set_data_perf');
var setupGeoJSONMap = require('../lib/setup_geojson_map');

var featureCollection = require('../data/naturalearth-land.json');

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
        map = setupGeoJSONMap(map);

        var source = map.getSource('geojson');

        evented.fire('log', {message: 'loading large feature collection'});
        setDataPerf(source, 50, featureCollection, function(err, ms) {
            if (err) return evented.fire('error', {error: err});
            evented.fire('end', {message: 'average load time: ' + formatNumber(ms) + ' ms', score: ms});
        });
    });

    return evented;
};
