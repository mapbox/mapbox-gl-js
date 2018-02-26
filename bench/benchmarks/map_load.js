
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

module.exports = class MapLoad extends Benchmark {
    bench() {
        return createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        }).then(map => map.remove());
    }
};
