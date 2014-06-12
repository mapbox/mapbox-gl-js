mapboxgl.accessToken = location.search.match(/access_token=([^&]*)/)[1];
mapboxgl.util.getJSON('/debug/style.json', function(err, style) {
    if (err) throw err;

    var map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [38.912753, -77.032194],
        style: style,
        hash: true
    });

    new mapboxgl.Navigation(map);

    // add geojson overlay
//    var geojson = new mapboxgl.GeoJSONSource({ type: 'Feature', properties: {}, geometry: route.routes[0].geometry});
//    map.addSource('geojson', geojson);
});

