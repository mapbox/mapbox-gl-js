window.mapboxglBenchmarks = window.mapboxglBenchmarks || {};

var targetName = process.env.BENCHMARK_TARGET;
function registerBenchmark(benchmarkName, benchmark) {
    window.mapboxglBenchmarks[benchmarkName] = window.mapboxglBenchmarks[benchmarkName] || {};
    window.mapboxglBenchmarks[benchmarkName][targetName] = benchmark;
}

registerBenchmark('map-load', require('./map_load'));
registerBenchmark('buffer', require('./buffer'));
registerBenchmark('fps', require('./fps'));
registerBenchmark('frame-duration', require('./frame_duration'));
registerBenchmark('query-point', require('./query_point'));
registerBenchmark('query-box', require('./query_box'));
registerBenchmark('geojson-setdata-small', require('./geojson_setdata_small'));
registerBenchmark('geojson-setdata-large', require('./geojson_setdata_large'));
