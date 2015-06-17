var urls = [
    'https://api.tiles.mapbox.com/mapbox-gl-js/v0.7.0/mapbox-gl.js',
    '/debug/mapbox-gl.js',
    'https://api.tiles.mapbox.com/mapbox-gl-js/v0.7.0/mapbox-gl.js',
    '/debug/mapbox-gl.js'
];

var duration = 3000;

Benchmark(urls, duration, setup, teardown);

function setup(state, callback) {

    mapboxgl.accessToken = getAccessToken();

    // change the area covered by the map map or the pixel density to check if cpu or fill bound
    //Benchmark.util.scaleArea('map', 2);
    //Benchmark.util.scalePixels(2);

    document.getElementById('map').innerHTML = '';
    var map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [38.912753, -77.032194],
        style: 'https://www.mapbox.com/mapbox-gl-styles/styles/bright-v7.json',
        hash: true
    });

    state.map = map;

    map.on('load', function() {
        map.repaint = true;
        callback();
    });
}

function teardown(state, callback) {
    state.map.repaint = false;
    callback();
}

function getAccessToken() {
    var match = location.search.match(/access_token=([^&\/]*)/);
    var accessToken = match && match[1];

    if (accessToken) {
        localStorage.accessToken = accessToken;
    } else {
        accessToken = localStorage.accessToken;
    }

    return accessToken;
}