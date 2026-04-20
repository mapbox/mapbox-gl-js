/* eslint-disable */

import mapboxgl from 'mapbox-gl/esm';

mapboxgl.accessToken = window.prompt("Enter access token");

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-74.5, 40],
    zoom: 9
});
