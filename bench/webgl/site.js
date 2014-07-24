var urls = [
    'http://localhost:8001/dist/mapbox-gl-dev.js',
    'https://mapbox.s3.amazonaws.com/mapbox-gl-js/dev-pages/mapbox-gl-dev.js',
    'http://localhost:8001/dist/mapbox-gl-dev.js',
    'https://mapbox.s3.amazonaws.com/mapbox-gl-js/dev-pages/mapbox-gl-dev.js'
];

var style = 'http://localhost:8001/debug/style.json';
        
var duration = 2000;
new FrameBench(urls, duration, setup, teardown, done);


function done(frames) {
    for (var i = 0; i < frames.length; i++) {
        console.log(frames[i].length / 2);
    }
}

function setup(state, callback) {

    mapboxgl.accessToken = 'pk.eyJ1IjoiYWlicmFtIiwiYSI6IkZfak1UWW8ifQ.czocTs_bwAYlC_JxXijA2A';
    document.getElementById('map').innerHTML = '';
    var map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [38.912753, -77.032194],
        style: style,
        hash: true
    });

    state.map = map;

    map.on('change:style', function() {
        allTilesLoaded(map, function() {
            map.repaint = true;
            callback(state);
        });
    });
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

function teardown(state, callback) {
    state.map.repaint = false;
    callback();
}
