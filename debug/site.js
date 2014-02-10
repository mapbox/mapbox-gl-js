
var map = new llmr.Map({
    container: document.getElementById('map'),
    sources: {
        "mapbox streets": {
            type: 'vector',
            id: 'streets',
            urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf'],
            // urls: ['http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
            zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
        },
        "satellite": {
            type: 'raster',
            id: 'satellite',
            urls: ['http://api.tiles.mapbox.com/v3/aibram.map-vlob92uz/{z}/{x}/{y}.png'],
            zooms: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
            enabled: false
        }
    },
    maxZoom: 20,
    zoom: 15,
    lat: 38.912753,
    lon: -77.032194,
    rotation: 0,
    style: style_json,
    hash: true
});

// add geojson overlay
var geojson = new llmr.GeoJSONSource({ type: 'Feature', properties: {}, geometry: route.routes[0].geometry}, map);
map.addSource('geojson', geojson);

new Debug(map);
