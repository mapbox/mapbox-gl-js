// @flow

import mapboxgl from '../src';
import accessToken from './lib/access_token';
mapboxgl.accessToken = accessToken;

window.mapboxglVersions = window.mapboxglVersions || [];
window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;
window.mapboxglVersions.push(version);

function register(Benchmark) {
    window.mapboxglBenchmarks[Benchmark.name] = window.mapboxglBenchmarks[Benchmark.name] || {};
    window.mapboxglBenchmarks[Benchmark.name][version] = new Benchmark();
}

import Layout from './benchmarks/layout';
import LayoutDDS from './benchmarks/layout_dds';
import Paint from './benchmarks/paint';
import LayerBenchmarks from './benchmarks/layers';
import Load from './benchmarks/map_load';
import Validate from './benchmarks/style_validate';
import StyleLayerCreate from './benchmarks/style_layer_create';
import QueryPoint from './benchmarks/query_point';
import QueryBox from './benchmarks/query_box';
import ExpressionBenchmarks from './benchmarks/expressions';
import FilterCreate from './benchmarks/filter_create';
import FilterEvaluate from './benchmarks/filter_evaluate';

register(Layout);
register(LayoutDDS);
register(Paint);
LayerBenchmarks.forEach(register);
register(Load);
register(Validate);
register(StyleLayerCreate);
register(QueryPoint);
register(QueryBox);
ExpressionBenchmarks.forEach(register);
register(FilterCreate);
register(FilterEvaluate);

// Ensure the global worker pool is never drained. Browsers have resource limits
// on the max number of workers that can be created per page.
import getWorkerPool from '../src/util/global_worker_pool';
// Set up the worker blob URL--written to window.mapboxGlWorkerUrl before this
// module is executed--before acquiring workers.
mapboxgl.workerUrl = window.mapboxGlWorkerUrl;
getWorkerPool().acquire(-1);
