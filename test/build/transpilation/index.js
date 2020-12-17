/* eslint-disable */

import mapboxgl from '../../../dist/mapbox-gl-csp.js';
import MapboxGLWorker from '../../../dist/mapbox-gl-csp-worker.js';

mapboxgl.accessToken = window.prompt("Enter access token");
mapboxgl.workerClass = MapboxGLWorker;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11', // stylesheet location
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9 // starting zoom
});