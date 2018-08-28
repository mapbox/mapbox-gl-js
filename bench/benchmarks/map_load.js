
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

export default class MapLoad extends Benchmark {
    bench() {
        return createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        }).then(map => map.remove());
    }
}
