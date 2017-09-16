'use strict';

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

// The goal of this benchmark is to measure the time it takes to run the cpu
// part of rendering. While the gpu rendering happens asynchronously, sometimes
// when the gpu falls behind the cpu commands synchronously wait for the gpu to catch up.
// This ends up affecting the duration of the call on the cpu.
//
// Setting the devicePixelRatio to a small number makes the canvas very small.
// This greatly reduces the amount of work the gpu needs to do and reduces the
// impact the actual rendering has on this benchmark.
window.devicePixelRatio = 1 / 16;

// TODO
const zooms = [4, 8, 11, 13, 15, 17];

module.exports = class Render extends Benchmark {
    setup() {
        return new Promise((resolve, reject) => {
            this.map = createMap({
                width: 1024,
                height: 768,
                zoom: 15,
                center: [-77.032194, 38.912753],
                style: 'mapbox://styles/mapbox/streets-v9'
            });

            this.map
                .on('load', resolve)
                .on('error', reject);
        })
    }

    bench() {
        this.map._styleDirty = true;
        this.map._sourcesDirty = true;
        this.map._render();
    }

    teardown() {
        this.map.remove();
        this.map.getContainer().remove();
    }
};
