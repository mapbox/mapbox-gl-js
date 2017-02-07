'use strict';

const Evented = require('../../src/util/evented');
const formatNumber = require('../lib/format_number');
const setDataPerf = require('../lib/set_data_perf');
const setupGeoJSONMap = require('../lib/setup_geojson_map');
const createMap = require('../lib/create_map');

const featureCollection = {
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
    const evented = new Evented();

    let map = createMap({
        width: 1024,
        height: 768,
        zoom: 5,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v9'
    });

    map.on('load', () => {
        map = setupGeoJSONMap(map);

        setDataPerf(map.style.sourceCaches.geojson, featureCollection, (err, ms) => {
            map.remove();
            if (err) return evented.fire('error', {error: err});
            evented.fire('end', {message: `${formatNumber(ms)} ms`, score: ms});
        });
    });

    return evented;
};
