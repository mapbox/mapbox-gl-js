
mapboxgl.accessToken = getAccessToken();

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 12.5,
    center: [-77.066104, 38.910203].reverse(),
    style: "blank_v8.json",
    hash: true
});

map.addControl(new mapboxgl.Navigation());

map.on('style.load', function() {
    map.addSource('geojson-point', {
        "type": "geojson",
        "data": {
            type: 'Point',
            coordinates: [-77.066104, 38.910203]
        }
    });
    map.addLayer({
        "id": "point-example",
        "type": "circle",
        "source": "geojson-point",
        "paint": {
            "circle-radius": 100,
            "circle-color": '#f00',
            "circle-blur": 0
        }
    }, 'point_circle');
});

map.on('click', function(e) {
    (new mapboxgl.Popup())
        .setLatLng(map.unproject(e.point))
        .setHTML("<h1>Hello World!</h1>")
        .addTo(map);
});

// keyboard shortcut for comparing rendering with Mapbox GL native
document.onkeypress = function(e) {
    if (e.charCode === 111 && !e.shiftKey && !e.metaKey && !e.altKey) {
        var center = map.getCenter();
        location.href = "mapboxgl://?center=" + center.lat + "," + center.lng + "&zoom=" + map.getZoom() + "&bearing=" + map.getBearing();
        return false;
    }
};

function getAccessToken() {
    var match = location.search.match(/access_token=([^&\/]*)/);
    var accessToken = match && match[1];

    if (accessToken) {
        localStorage.accessToken = accessToken;
    } else {
        accessToken = localStorage.accessToken;
    }

    return accessToken;
}
