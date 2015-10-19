var urls = [
    '/dist/mapbox-gl.js',
    'https://api.tiles.mapbox.com/mapbox-gl-js/v0.11.2/mapbox-gl.js',
    '/dist/mapbox-gl.js',
    'https://api.tiles.mapbox.com/mapbox-gl-js/v0.11.2/mapbox-gl.js',
    '/dist/mapbox-gl.js',
    'https://api.tiles.mapbox.com/mapbox-gl-js/v0.11.2/mapbox-gl.js'
];

var TEST_DURATION = 35 * 1000;
var WARMUP_DURATION = 5 * 1000;

Benchmark(urls, TEST_DURATION, setup, teardown);

function setup(state, callback) {

    mapboxgl.accessToken = getAccessToken();

    // change the area covered by the map map or the pixel density to check if cpu or fill bound
    //Benchmark.util.scaleArea('map', 2);
    //Benchmark.util.scalePixels(2);

    document.getElementById('map').innerHTML = '';
    var map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v8',
        hash: false
    });

    state.map = map;

    map.on('load', function() {
        setTimeout(function() {
            callback();
        }, WARMUP_DURATION);
    });
}

function teardown(state, callback) {
    state.map.style._remove();
    callback();
}

function getAccessToken() {
    var match = location.search.match(/access_token=([^&\/]*)/);
    var accessToken = match && match[1];

    if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
    } else {
        accessToken = localStorage.getItem('accessToken');
    }

    return accessToken;
}
