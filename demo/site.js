
var map = new llmr.Map({
    container: document.getElementById('map'),
    datasources: {
        'streets': {
            type: 'vector',
            urls: ['/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        },
        'terrain': {
            type: 'vector',
            urls: ['/gl/tiles/terrain/{z}-{x}-{y}.vector.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        },
        'satellite': {
            type: 'raster',
            urls: ['//api.tiles.mapbox.com/v3/aibram.map-vlob92uz/{z}/{x}/{y}.png'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            enabled: false
        }
    },
    maxZoom: 20,
    zoom: 13,
    lat: 37.772537,
    lon: -122.420679,
    rotation: 0,
    style: style_json,
    hash: true
});
new Debug(map);
