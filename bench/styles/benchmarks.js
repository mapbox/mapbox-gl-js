import mapboxgl from '../../src';
import accessToken from '../lib/access_token';
import locations from '../lib/style_locations';
import { summaryStatistics, regression } from '../lib/statistics';
import updateUI from '../benchmarks_view';

mapboxgl.accessToken = accessToken;

const benchmarks = [];
const filter = window.location.hash.substr(1);

function register(Benchmark, locations, options) {
    const name = Benchmark.name;

    if (filter && name !== filter)
        return;

    const benchmark = {
        name: Benchmark.name,
        versions: []
    };

    if (options) Object.assign(benchmark, options);

    process.env.MAPBOX_STYLES.forEach(style => {
        const { name } = style;
        benchmark.versions.push({
            name: name ? name : style.replace('mapbox://styles/', ''),
            bench: new Benchmark(style, locations),
            status: 'waiting',
            logs: [],
            samples: [],
            summary: {}
        });
    });
    benchmarks.push(benchmark);
}

import StyleLayerCreate from '../benchmarks/style_layer_create';
import Validate from '../benchmarks/style_validate';
import Layout from '../benchmarks/layout';
import Paint from '../benchmarks/paint';
import QueryPoint from '../benchmarks/query_point';
import QueryBox from '../benchmarks/query_box';

register(StyleLayerCreate);
register(Validate);
locations.forEach(location => register(Layout, location.tileID, {location}));
locations.forEach(location => register(Paint, [location], {location}));
register(QueryPoint, locations);
register(QueryBox, locations);

import getWorkerPool from '../../src/util/global_worker_pool';

let promise = Promise.resolve();

promise = promise.then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getWorkerPool().acquire(-1);
});
benchmarks.forEach(bench => {
    bench.versions.forEach(version => {
        promise = promise.then(() => {
            version.status = 'running';
            updateUI(benchmarks);

            return version.bench.run()
                .then(measurements => {
                    // scale measurements down by iteration count, so that
                    // they represent (average) time for a single iteration
                    const samples = measurements.map(({time, iterations}) => time / iterations);
                    version.status = 'ended';
                    version.samples = samples;
                    version.summary = summaryStatistics(samples);
                    version.regression = regression(measurements);
                    updateUI(benchmarks);
                })
                .catch(error => {
                    version.status = 'errored';
                    version.error = error;
                    updateUI(benchmarks);
                });
        });
    });

    promise = promise.then(() => {
        updateUI(benchmarks, true);
    });
});

export default mapboxgl;
