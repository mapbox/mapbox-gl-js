'use strict';

module.exports = function(map) {
    map.addSource('geojson', {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': []
        }
    });

    map.addLayer({
        'id': 'geojson-polygon',
        'source': 'geojson',
        'type': 'fill',
        'filter': ['all', ['==', '$type', 'Polygon']],
        'paint': {
            'fill-color': '#000000',
            'fill-opacity': 0.25
        }
    });

    map.addLayer({
        'id': 'geojson-point',
        'source': 'geojson',
        'type': 'circle',
        'filter': ['all', ['==', '$type', 'Point']],
        'paint': {
            'circle-radius': 5,
            'circle-color': '#000000'
        }
    });

    return map;
};
