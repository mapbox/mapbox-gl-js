'use strict';

var llmr = require('../'),
    route = require('./route'),
    style_json = require('./style-streets');

if (typeof document !== 'undefined') {
    var map = window.map = new llmr.Map({
        container: document.getElementById('map'),
        sources: {
            "mapbox streets": {
                type: 'vector',
                urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf'],
                // urls: ['http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
                tileSize: 512,
                zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
            },
            "satellite": {
                type: 'raster',
                urls: ['http://api.tiles.mapbox.com/v3/aibram.map-vlob92uz/{z}/{x}/{y}.png'],
                zooms: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
            }
        },
        zoom: 15,
        center: [38.912753, -77.032194],
        style: style_json,
        hash: true
    });

    new llmr.Navigation(map);

    // add geojson overlay
    var geojson = new llmr.GeoJSONSource({ type: 'Feature', properties: {}, geometry: route.routes[0].geometry});
    map.addSource('geojson', geojson);
}
