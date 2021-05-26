import LngLat from '../lng_lat.js';

// leaving Winkel Tripel methods as noop for now while we decide on implementation issues
export default {
    name: 'winkel',
    range: [3.5, 7],
    project: (lng, lat) => {},
    unproject: (x, y) => {}
};
