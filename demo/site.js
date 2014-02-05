
var map = new llmr.Map({
    container: document.getElementById('map'),
    datasources: {
        'streets': {
            type: 'vector',
            urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        },
        'terrain': {
            type: 'vector',
            urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        },
        'satellite': {
            type: 'raster',
            urls: ['http://api.tiles.mapbox.com/v3/aibram.map-vlob92uz/{z}/{x}/{y}.png'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
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
