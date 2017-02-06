'use strict';

window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
function registerBenchmark(name, benchmark) {
    window.mapboxglBenchmarks[name] = window.mapboxglBenchmarks[name] || {};
    window.mapboxglBenchmarks[name][version] = benchmark;
}

registerBenchmark('map-load', require('./benchmarks/map_load'));
registerBenchmark('style-load', require('./benchmarks/style_load'));
registerBenchmark('buffer', require('./benchmarks/buffer'));
registerBenchmark('fps', require('./benchmarks/fps'));
registerBenchmark('frame-duration', require('./benchmarks/frame_duration'));
registerBenchmark('query-point', require('./benchmarks/query_point'));
registerBenchmark('query-box', require('./benchmarks/query_box'));
registerBenchmark('geojson-setdata-small', require('./benchmarks/geojson_setdata_small'));
registerBenchmark('geojson-setdata-large', require('./benchmarks/geojson_setdata_large'));

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
require('../src/util/global_worker_pool')().acquire(-1);
