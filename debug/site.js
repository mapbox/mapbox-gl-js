
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

    var bufferTimes = {};
    map.on('tile.stats', function(bufferTimes) {
        var _stats = [];
        for (var name in bufferTimes) {
            var value = Math.round(bufferTimes[name]);
            if (isNaN(value)) continue;
            var width = value;
            _stats.push({name: name, value: value, width: width});
        }
        _stats = _stats.sort(function(a, b) { return b.value - a.value }).slice(0, 10);

        var html = '';
        for (var i in _stats) {
            html += '<div style="width:' + _stats[i].width + 'px">' + _stats[i].value + 'ms - ' + _stats[i].name + '</div>';
        }

        document.getElementById('buffer').innerHTML = html;
    });
});

map.on('click', function(e) {
    if (e.originalEvent.shiftKey) return;
    (new mapboxgl.Popup())
        .setLngLat(map.unproject(e.point))
        .setHTML("<h1>Hello World!</h1>")
        .addTo(map);
});

document.getElementById('debug-checkbox').onclick = function() {
    map.debug = !!this.checked;
};

document.getElementById('collision-debug-checkbox').onclick = function() {
    map.collisionDebug = !!this.checked;
};

document.getElementById('buffer-checkbox').onclick = function() {
    document.getElementById('buffer').style.display = this.checked ? 'block' : 'none';
};

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
