import { Map } from 'mapbox-gl/esm';
import 'mapbox-gl/mapbox-gl.css';

new Map({
    container: 'map',
    center: [-74.5, 40],
    zoom: 9,
    accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
});
