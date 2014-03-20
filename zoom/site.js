if (!window.location.hash) {
    window.location.hash = '15.06/38.916686/-77.038784/0.0'
}

var map = new llmr.Map({
    container: document.getElementById('map'),
    sources: {
        'terrain': {
            type: 'vector',
            urls: ['https://a.tiles.mapbox.com/v3/mapbox.mapbox-terrain-v1,mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
            zooms: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14]
        },
        'streets': {
            type: 'vector',
            urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        }
    },
    maxZoom: 20,
    zoom: 19,
    lat: 37.772537,
    lon: -122.420679,
    rotation: 0,
    style: style_json,
    hash: true
});

map.style.setClassList(['terrain'])

var tick = 0;
var places = [
    [41.8756208, -87.6243706],
    [37.7756648, -122.4136613],
    [-54.815705, -68.306905],
    [9.116267, -79.698239],
    [-33.925911, 18.423378],
    [48.852274, 2.352175],
    [-0.697770, -90.327458],
    [44.951838, 34.101434],
    [41.888297, 12.490745],
    [12.979275, 77.590377],
    [6.454116, 3.394557],
    [35.679458, 139.76845],
    [59.324771, 18.071048]
];

function goToNewPlace(latlng) {
    map.zoomPanTo(places[tick], 16, .6, 1.42);
}

setInterval(function () {
    tick++
    if (tick < places.length) {
        goToNewPlace(places[tick]);
    } else {
        tick = 0;
    }
}, 15000);

tick++
goToNewPlace(places[tick]);
