'use strict';

const Evented = require('../../src/util/evented');
const formatNumber = require('../lib/format_number');
const createMap = require('../lib/create_map');

module.exports = function() {
    const evented = new Evented();

    const mapsOnPage = 6;

    evented.fire('log', { message: `Creating ${mapsOnPage} maps` });

    let loaded = 0;
    const maps = [];
    const start = Date.now();
    for (let i = 0; i < mapsOnPage; i++) {
        const map = maps[i] = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });
        map.on('load', onload.bind(null, map));
        map.on('error', (err) => {
            evented.fire('error', err);
        });
    }

    function onload () {
        if (++loaded >= mapsOnPage) {
            const duration = Date.now() - start;
            for (let i = 0; i < maps.length; i++) {
                maps[i].remove();
            }
            evented.fire('end', {
                message: `${formatNumber(duration)} ms`,
                score: duration
            });
            done();
        }
    }

    function done () {
    }

    return evented;
};
