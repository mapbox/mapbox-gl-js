'use strict';

var Mapbox = require('../js/mapbox-gl');

console.log('main');

Mapbox.accessToken = getAccessToken();

var map = new Mapbox.Map({
    container: 'map',
    zoom: 12.5,
    center: [38.888, -77.01866],
    style: 'https://www.mapbox.com/mapbox-gl-styles/styles/bright-v7.json',
    hash: true
});

map.on('style.load', function() {
    map.addSource('geojson', {
        "type": "geojson",
        "data": "../debug/route.json"
    });

    map.addLayer({
        "id": "route",
        "type": "line",
        "source": "geojson",
        "paint": {
            "line-color": "#EC8D8D",
            "line-width": "@motorway_width"
        }
    }, 'country_label_1');
});

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
