
mapboxgl.accessToken = getAccessToken();

var map = window.map = new mapboxgl.Map({
    container: 'map',
    zoom: 12.5,
    center: [-77.01866, 38.888],
    style: 'mapbox://styles/mapbox/streets-v8',
    hash: true
});

map.addControl(new mapboxgl.Navigation());
map.addControl(new mapboxgl.Geolocate());

map.on('load', function() {
    map.addSource('geojson', {
        "type": "geojson",
        "data": "route.json"
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
        "data": "random.geojson"
    });

    map.addLayer({
        "id": "random-points",
        "type": "circle",
        "source": "geojson-random-points",
        "paint": {
            "circle-radius": {
                property: "mapbox",
                stops: [
                    [{ zoom: 0, value: 0 }, 2],
                    [{ zoom: 0, value: 100 }, 10],
                    [{ zoom: 6, value: 0 }, 20],
                    [{ zoom: 6, value: 100 }, 100]
                ]
            },
            "circle-color": {
                property: "mapbox",
                stops: [
                    [{ zoom: 0, value: 0 }, 'red'],
                    [{ zoom: 0, value: 100 }, 'violet'],
                    [{ zoom: 6, value: 0 }, 'blue'],
                    [{ zoom: 6, value: 100 }, 'green']
                ]
            }
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
            html += '<div style="width:' + _stats[i].width * 2 + 'px">' + _stats[i].value + 'ms - ' + _stats[i].name + '</div>';
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

document.getElementById('show-tile-boundaries-checkbox').onclick = function() {
    map.showTileBoundaries = !!this.checked;
};

document.getElementById('show-symbol-collision-boxes-checkbox').onclick = function() {
    map.showCollisionBoxes = !!this.checked;
};

document.getElementById('show-overdraw-checkbox').onclick = function() {
    map.showOverdrawInspector = !!this.checked;
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
    var accessToken = (
        process.env.MapboxAccessToken ||
        process.env.MAPBOX_ACCESS_TOKEN ||
        getURLParameter('access_token') ||
        localStorage.getItem('accessToken')
    );
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}

function getURLParameter(name) {
    var regexp = new RegExp('[?&]' + name + '=([^&#]*)', 'i');
    var output = regexp.exec(window.location.href);
    return output && output[1];
}
