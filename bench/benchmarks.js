'use strict';

window.mapboxglVersions = window.mapboxglVersions || [];
window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
window.mapboxglVersions.push('master');
window.mapboxglVersions.push(version);

function register(Benchmark) {
    window.mapboxglBenchmarks[Benchmark.name] = window.mapboxglBenchmarks[Benchmark.name] || {};
    window.mapboxglBenchmarks[Benchmark.name].master = new Benchmark();
    window.mapboxglBenchmarks[Benchmark.name][version] = new Benchmark();
}

register(require('./benchmarks/tile_parse'));
register(require('./benchmarks/render'));
register(require('./benchmarks/map_load'));
register(require('./benchmarks/style_load'));
register(require('./benchmarks/geojson_setdata_large'));
register(require('./benchmarks/geojson_setdata_small'));

// register(require('./benchmarks/tile_layout_dds'));
// register(require('./benchmarks/query_point'));
// register(require('./benchmarks/query_box'));
// register(require('./benchmarks/filter'));

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
require('../src/util/global_worker_pool')().acquire(-1);
