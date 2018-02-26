
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

const width = 1024;
const height = 768;
const zooms = [4, 8, 11, 13, 15, 17];

module.exports = class QueryBox extends Benchmark {
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
            map.queryRenderedFeatures({});
        }
    }

    teardown() {
        for (const map of this.maps) {
            map.remove();
        }
    }
};
