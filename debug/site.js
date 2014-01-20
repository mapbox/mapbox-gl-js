var DEBUG = true;
var ds;

domready(function() {
    globalMap = new llmr.Map({
        container: document.getElementById('map'),
        datasources: {
            "mapbox streets": {
                type: 'vector',
                id: 'streets',
                urls: ['/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'],
                // urls: ['http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
                zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
            },
            "satellite": {
                type: 'raster',
                id: 'satellite',
                urls: ['/gl/raster/{z}-{x}-{y}.png'],
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
    ds = new llmr.GeoJSONDatasource({ type: 'Feature', properties: {}, geometry: route.routes[0].geometry}, globalMap);
    globalMap.addDatasource('geojson', ds);
    new Debug(globalMap);
});
