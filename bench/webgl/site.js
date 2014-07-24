var urls = [
    'http://localhost:8001/dist/mapbox-gl-dev.js',
    'https://mapbox.s3.amazonaws.com/mapbox-gl-js/symbol-collision-groups/mapbox-gl-dev.js'
];

var styleURL = 'http://localhost:8001/debug/style.json';
        
var duration = 1000;
var bench = new FrameBench(urls, duration, setup, teardown);
var style;

bench.onready = function() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiYWlicmFtIiwiYSI6IkZfak1UWW8ifQ.czocTs_bwAYlC_JxXijA2A';
    mapboxgl.util.getJSON(styleURL, run);
};

function run(err, s) {
    style = s;
    bench.run(done);
}

function done(frames) {
    console.log('done', frames);
}

function setup(mapboxgl, callback) {
    var state = {};

    document.getElementById('map').innerHTML = '';
    var map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [38.912753, -77.032194],
        style: style,
        hash: true
    });

    state.map = map;

    allTilesLoaded(map, function() {
        map.repaint = true;
        callback(state);
    });
}

function teardown(state, callback) {
    state.map.repaint = false;
    callback();
}

function allTilesLoaded(map, callback) {
    var check = window.setInterval(function() {
        for (var s in map.sources) {
            var source = map.sources[s];
            for (var t in source.tiles) {
                if (!source.tiles[t].loaded) return;
            }
        }
        window.clearInterval(check);
        callback();
    }, 100);
}
