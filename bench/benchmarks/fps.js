'use strict';

const Evented = require('../../src/util/evented');
const formatNumber = require('../lib/format_number');
const measureFramerate = require('../lib/measure_framerate');
const createMap = require('../lib/create_map');

const DURATION_MILLISECONDS = 5 * 1000;

module.exports = function() {
    const evented = new Evented();

    const map = createMap({
        width: 1024,
        height: 768,
        zoom: 5,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v9'
    });

    map.on('load', () => {
        map.repaint = true;

        evented.fire('log', {
            message: `starting ${formatNumber(DURATION_MILLISECONDS / 1000)} second test`,
            color: 'dark'
        });

        measureFramerate(DURATION_MILLISECONDS, (err, fps) => {
            map.remove();
            if (err) {
                evented.fire('error', { error: err });
            } else {
                evented.fire('end', {
                    message: `${formatNumber(fps)} fps`,
                    score: 1 / fps
                });
            }
        });
    });

    return evented;
};
