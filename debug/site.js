
mapboxgl.accessToken = getAccessToken();

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 12.5,
    center: [-77.01866, 38.888],
    style: 'mapbox://styles/mapbox/streets-v8',
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
            "line-width": {
                "base": 1.5,
                "stops": [
                    [
                        5,
                        0.75
                    ],
                    [
                        18,
                        32
                    ]
                ]
            }
        }
    }, 'country-label-lg');

    map.addSource('geojson-random-points', {
        "type": "geojson",
        "data": "/debug/random.geojson"
    });

    map.addLayer({
        "id": "random-points",
        "type": "circle",
        "source": "geojson-random-points",
        "paint": {
            "circle-radius": 5,
            "circle-color": "#f0f"
        }
    });
});

map.on('click', function(e) {
    (new mapboxgl.Popup())
        .setLngLat(map.unproject(e.point))
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
