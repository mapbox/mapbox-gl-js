'use strict';

var Evented = require('../../js/util/evented');
var util = require('../../js/util/util');
var formatNumber = require('../lib/format_number');
var setDataPerf = require('../lib/set_data_perf');
var setupGeoJSONMap = require('../lib/setup_geojson_map');
var createMap = require('../lib/create_map');

var featureCollection = {
    'type': 'FeatureCollection',
    'features': [{
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'Point',
            'coordinates': [ -77.032194, 38.912753 ]
        }
    }]
};

module.exports = function() {
    var evented = util.extend({}, Evented);

    var map = createMap({
        width: 1024,
        height: 768,
        zoom: 5,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v9'
    });

    map.on('load', function() {
        map = setupGeoJSONMap(map);

        var source = map.getSource('geojson');

        setDataPerf(source, 50, featureCollection, function(err, ms) {
            map.remove();
            if (err) return evented.fire('error', {error: err});
            evented.fire('end', {message: formatNumber(ms) + ' ms', score: ms});
        });
    });

    return evented;
};
