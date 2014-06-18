
var match = location.search.match(/access_token=([^&\/]*)/);
var accessToken = match && match[1];

if (accessToken) {
    localStorage.accessToken = accessToken;
} else {
    accessToken = localStorage.accessToken;
}

var map;
mapboxgl.accessToken = accessToken;
mapboxgl.util.getJSON('/debug/style-v3.json', function(err, style) {
    if (err) throw err;

   map = new mapboxgl.Map({
        container: 'map',
        zoom: 15,
        center: [38.912753, -77.032194],
        style: style,
        hash: true
    });

    new mapboxgl.Navigation(map);

    // add geojson overlay
    var geojson = new mapboxgl.GeoJSONSource({
        glyphs: "http://mapbox.s3.amazonaws.com/gl-glyphs-256/{fontstack}/{range}.pbf",
        geojson: { type: 'Feature', properties: { name: "ABCDABCDABCD" }, geometry: route.routes[0].geometry}
    });
    map.addSource('geojson', geojson);
});

