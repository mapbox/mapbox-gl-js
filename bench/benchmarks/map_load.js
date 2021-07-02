
import Benchmark from '../lib/benchmark.js';
import createMap from '../lib/create_map.js';

export default class MapLoad extends Benchmark {
    bench() {
        return createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        })
            .then(map => map.remove())
            .catch(error => {
                console.error(error);
            });
    }
}
