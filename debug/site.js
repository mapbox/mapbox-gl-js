
var match = location.search.match(/access_token=([^&\/]*)/);
var accessToken = match && match[1];

if (accessToken) {
    localStorage.accessToken = accessToken;
} else {
    accessToken = localStorage.accessToken;
}

mapboxgl.accessToken = accessToken;

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 15,
    center: [38.912753, -77.032194],
    style: '/debug/style.json',
    hash: true
});

new mapboxgl.Navigation(map);

// add geojson overlay
var geojson = new mapboxgl.GeoJSONSource({
    data: {
        type: 'Feature',
        properties: { name: "ABCDABCDABCD" },
        geometry: route.routes[0].geometry
    }
});

map.addSource('geojson', geojson);

document.onkeypress = function(e) {
    if (e.charCode === 111 && !e.shiftKey && !e.metaKey && !e.altKey) {
        var center = map.getCenter();
        location.href = "mapboxgl://?center=" + center.lat + "," + center.lng + "&zoom=" + map.getZoom() + "&bearing=" + map.getBearing();
        return false;
    }
};