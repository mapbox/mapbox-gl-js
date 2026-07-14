import mapboxgl from 'mapbox-gl';

mapboxgl.addTileProvider('pmtiles', `${location.origin}/mapbox-gl-pmtiles-provider.js`);

const map = new mapboxgl.Map({
    container: 'map',
    testMode: true,
    style: {version: 8, sources: {}, layers: []}
});

map.on('load', () => {
    map.addSource('pmtiles', {type: 'vector', url: `${location.origin}/vector.pmtiles`});
});
