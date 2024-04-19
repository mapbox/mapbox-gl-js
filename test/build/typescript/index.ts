/* eslint-disable */

import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = localStorage.getItem('accessToken') || window.prompt('Enter access token');
localStorage.setItem('accessToken', mapboxgl.accessToken);

//
// Map constructor
//

const map = new mapboxgl.Map({
    container: 'map',
    center: [-96, 37.8],
    zoom: 2,
    hash: true,
    attributionControl: false,
});

//
// Controls, Markers, and Popups
//

map.addControl(new mapboxgl.ScaleControl());
map.addControl(new mapboxgl.GeolocateControl());
map.addControl(new mapboxgl.NavigationControl());
map.addControl(new mapboxgl.FullscreenControl());
map.addControl(new mapboxgl.AttributionControl());

const center = mapboxgl.LngLat.convert(map.getCenter());

const popup = new mapboxgl.Popup()
    .setText('Hello, World! 👋');

new mapboxgl.Marker()
    .setLngLat(center)
    .setPopup(popup)
    .addTo(map);

await new Promise((resolve) => map.on('style.load', resolve));

map.setConfigProperty('basemap', 'lightPreset', 'dawn');

//
// Loading images
//

const image = await new Promise<ImageData>((resolve, reject) =>
    map.loadImage('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png', (error: Error, image: ImageData) => {
        if (error) reject(error);
        resolve(image);
    })
);

map.addImage('custom-marker', image);

//
// Adding sources
//

map.addSource('urban-areas', {
    'type': 'geojson',
    'data': 'https://docs.mapbox.com/mapbox-gl-js/assets/ne_50m_urban_areas.geojson'
});

map.addSource('points', {
    'type': 'geojson',
    'data': {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [-77.03238901390978, 38.913188059745586]
                },
                'properties': {
                    'title': 'Mapbox DC'
                }
            },
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [-122.414, 37.776]
                },
                'properties': {
                    'title': 'Mapbox SF'
                }
            }
        ]
    }
});

//
// Adding layers
//

map.addLayer({
    'id': 'urban-areas-fill',
    'type': 'fill',
    'slot': 'middle',
    'source': 'urban-areas',
    'layout': {},
    'paint': {
        'fill-color': '#f08',
        'fill-opacity': 0.4,
        'fill-emissive-strength': 0.8,
    }
});

map.addLayer({
    'id': 'points',
    'type': 'symbol',
    'source': 'points',
    'layout': {
        'icon-image': 'custom-marker',
        'text-field': ['get', 'title'],
        'text-font': [
            'Open Sans Semibold',
            'Arial Unicode MS Bold'
        ],
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
    }
});

//
// Add 3D terrain
//

map.addSource('mapbox-dem', {
    'type': 'raster-dem',
    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
    'tileSize': 512,
    'maxzoom': 14
});

map.setTerrain({'source': 'mapbox-dem', 'exaggeration': 1.5});
