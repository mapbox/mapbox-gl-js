var urls = [
    '/dist/mapbox-gl.js',
    '/dist/mapbox-gl.js'
];

var duration = 30 * 1000;

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
        center: [-77.032194, 38.912753],
        style: 'mapbox://styles/mapbox/bright-v8',
        hash: false
    });

    state.map = map;

    map.on('load', function() {
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
        localStorage.setItem('accessToken', accessToken);
    } else {
        accessToken = localStorage.getItem('accessToken');
    }

    return accessToken;
}
