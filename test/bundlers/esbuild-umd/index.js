import mapboxgl from 'mapbox-gl';

window.map = new mapboxgl.Map({
    container: 'map',
    testMode: true,
    // A layer is needed so that tiles are parsed in the worker.
    style: {
        version: 8,
        sources: {points: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}},
        layers: [{id: 'points', type: 'circle', source: 'points'}]
    }
});
