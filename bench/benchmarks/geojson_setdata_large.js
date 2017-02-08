'use strict';

const Evented = require('../../src/util/evented');
const formatNumber = require('../lib/format_number');
const setDataPerf = require('../lib/set_data_perf');
const setupGeoJSONMap = require('../lib/setup_geojson_map');
const createMap = require('../lib/create_map');
const ajax = require('../../src/util/ajax');

module.exports = function() {
    const evented = new Evented();

    setTimeout(() => {
        evented.fire('log', {message: 'downloading large geojson'});
    }, 0);

    ajax.getJSON('http://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson', (err, data) => {
        evented.fire('log', {message: 'starting test'});

        if (err) return evented.fire('error', {error: err});

        let map = createMap({
            width: 1024,
            height: 768,
            zoom: 5,
            center: [-77.032194, 38.912753],
            style: 'mapbox://styles/mapbox/bright-v9'
        });

        map.on('load', () => {
            map = setupGeoJSONMap(map);

            setDataPerf(map.style.sourceCaches.geojson, data, (err, ms) => {
                if (err) return evented.fire('error', {error: err});
                map.remove();
                evented.fire('end', {message: `${formatNumber(ms)} ms`, score: ms});
            });
        });
    });

    return evented;
};
