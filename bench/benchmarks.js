// @flow

require('../src').accessToken = require('./lib/access_token');

window.mapboxglVersions = window.mapboxglVersions || [];
window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
window.mapboxglVersions.push(version);

function register(Benchmark) {
    window.mapboxglBenchmarks[Benchmark.name] = window.mapboxglBenchmarks[Benchmark.name] || {};
    window.mapboxglBenchmarks[Benchmark.name][version] = new Benchmark();
}

register(require('./benchmarks/layout'));
register(require('./benchmarks/layout_dds'));
register(require('./benchmarks/paint'));
require('./benchmarks/layers').forEach(register);
register(require('./benchmarks/map_load'));
register(require('./benchmarks/style_validate'));
register(require('./benchmarks/style_layer_create'));
register(require('./benchmarks/query_point'));
register(require('./benchmarks/query_box'));
require('./benchmarks/expressions').forEach(register);
register(require('./benchmarks/filter_create'));
register(require('./benchmarks/filter_evaluate'));

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
require('../src/util/global_worker_pool')().acquire(-1);
