'use strict';

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

module.exports = class MapLoad extends Benchmark {
    bench() {
        return new Promise((resolve, reject) => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map
                .on('error', reject)
                .on('load', () => {
                    resolve();
                    map.remove();
                });
        });
    }
};
