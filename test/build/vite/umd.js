import mapbox from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapbox.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

new mapbox.Map({
    container: 'map',
    center: [-74.5, 40],
    zoom: 9
});
