
const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

const width = 1024;
const height = 768;
const zooms = [4, 8, 11, 13, 15, 17];

const points = [];
const d = 4;
for (let x = 0; x < d; x++) {
    for (let y = 0; y < d; y++) {
        points.push([
            (x / d) * width,
            (y / d) * height
        ]);
    }
}

module.exports = class QueryPoint extends Benchmark {
    setup() {
        return Promise.all(zooms.map(zoom => {
            return createMap({
                zoom,
                width,
                height,
                center: [-77.032194, 38.912753],
                style: 'mapbox://styles/mapbox/streets-v9'
            });
        })).then(maps => { this.maps = maps; });
    }

    bench() {
        for (const map of this.maps) {
            for (const point of points) {
                map.queryRenderedFeatures(point, {});
            }
        }
    }

    teardown() {
        for (const map of this.maps) {
            map.remove();
        }
    }
};
