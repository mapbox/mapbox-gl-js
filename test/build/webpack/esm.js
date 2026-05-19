/* eslint-disable */

import { Map } from 'mapbox-gl/esm';

const map = new Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-74.5, 40],
    zoom: 9,
    accessToken: window.prompt("Enter access token")
});
