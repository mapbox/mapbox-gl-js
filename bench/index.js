'use strict';

var mapboxgl = require('../js/mapbox-gl');
var util = require('../js/util/util');

try {
    main();
} catch (err) {
    log('red', err.toString());
    throw err;
}

function main() {
    log('dark', 'please keep this window in the foreground and close the debugger');

    var benchmarks = {
        buffer: require('./benchmarks/buffer'),
        fps: require('./benchmarks/fps'),
        'frame-duration': require('./benchmarks/frame_duration'),
        'query-point': require('./benchmarks/query_point'),
        'query-box': require('./benchmarks/query_box'),
        'geojson-setdata-small': require('./benchmarks/geojson_setdata_small'),
        'geojson-setdata-large': require('./benchmarks/geojson_setdata_large')
    };

    var benchmarksDiv = document.getElementById('benchmarks');

    Object.keys(benchmarks).forEach(function(id) {
        benchmarksDiv.innerHTML += '<a href="/bench/' + id + '" class="button">' + id + '</a>';
    });

    var pathnameArray = location.pathname.split('/');
    var benchmarkName = pathnameArray[pathnameArray.length - 1] || pathnameArray[pathnameArray.length - 2];
    var createBenchmark = benchmarks[benchmarkName];
    if (!createBenchmark) throw new Error('unknown benchmark "' + benchmarkName + '"');

    var benchmark = createBenchmark({
        accessToken: getAccessToken(),
        createMap: createMap
    });

    benchmark.on('log', function(event) {
        log(event.color || 'blue', event.message);
        scrollToBottom();
    });

    benchmark.on('end', function(event) {
        log('green', '<strong class="prose-big">' + event.message + '</strong>');
        scrollToBottom();
    });

    benchmark.on('error', function(event) {
        log('red', event.error);
        scrollToBottom();
    });
}

function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
}

function log(color, message) {
    document.getElementById('logs').innerHTML += '<div class="log dark fill-' + color + '"><p>' + message + '</p></div>';
}

function getAccessToken() {
    var accessToken = (
        process.env.MapboxAccessToken ||
        process.env.MAPBOX_ACCESS_TOKEN ||
        getURLParameter('access_token') ||
        localStorage.getItem('accessToken')
    );
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}

function getURLParameter(name) {
    var regexp = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    var output = regexp.exec(window.location.href);
    return output && output[1];
}

function createMap(options) {
    var mapElement = document.getElementById('map');

    options = util.extend({width: 512, height: 512}, options);

    mapElement.style.display = 'block';
    mapElement.style.width = options.width + 'px';
    mapElement.style.height = options.height + 'px';

    mapboxgl.accessToken = getAccessToken();
    return new mapboxgl.Map(util.extend({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v9',
        interactive: false
    }, options));
}
