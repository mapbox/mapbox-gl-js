
mapboxgl.accessToken = getAccessToken();

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 12.5,
    center: [38.888, -77.01866],
    style: 'https://www.mapbox.com/mapbox-gl-styles/styles/bright-v7.json',
    hash: true
});

map.addControl(new mapboxgl.Navigation());

map.on('style.load', function() {
    map.addSource('geojson', {
        "type": "geojson",
        "data": "/debug/route.json"
    });

    map.addLayer({
        "id": "route",
        "type": "line",
        "source": "geojson",
        "paint": {
            "line-color": "#EC8D8D",
            "line-width": "@motorway_width"
        }
    });
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
