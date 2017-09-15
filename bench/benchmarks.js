'use strict';

window.mapboxglVersions = window.mapboxglVersions || [];
window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
window.mapboxglVersions.push(version);

function register(benchmarks) {
    for (const Benchmark of [].concat(benchmarks)) {
        const benchmark = new Benchmark();
        window.mapboxglBenchmarks[benchmark.name] = window.mapboxglBenchmarks[benchmark.name] || {};
        window.mapboxglBenchmarks[benchmark.name][version] = benchmark;
    }
}

register(require('./benchmarks/buffer'));
// registerBenchmarks('map-load', require('./benchmarks/map_load'));
// registerBenchmarks('style-load', require('./benchmarks/style_load'));
// registerBenchmarks('tile_layout_dds', require('./benchmarks/tile_layout_dds'));
// registerBenchmarks('fps', require('./benchmarks/fps'));
// registerBenchmarks('frame-duration', require('./benchmarks/frame_duration'));
// registerBenchmarks('query-point', require('./benchmarks/query_point'));
// registerBenchmarks('query-box', require('./benchmarks/query_box'));
// registerBenchmarks('geojson-setdata-small', require('./benchmarks/geojson_setdata_small'));
// registerBenchmarks('geojson-setdata-large', require('./benchmarks/geojson_setdata_large'));
// registerBenchmarks('filter', require('./benchmarks/filter'));

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
require('../src/util/global_worker_pool')().acquire(-1);
