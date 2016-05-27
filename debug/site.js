
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

    // Add a new source from our GeoJSON data and set the
    // 'cluster' option to true.
    map.addSource("earthquakes", {
        type: "geojson-clustered",
        // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
        // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
        data: "https://www.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson",
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
    });

    // Use the earthquakes source to create five layers:
    // One for non-clustered markers, three for each cluster category,
    // and one for cluster labels.
    map.addLayer({
        "id": "non-cluster-markers",
        "type": "symbol",
        "source": "earthquakes",
        "layout": {
            "icon-image": "marker-15"
        }
    });

    // Display the earthquake data in three layers, each filtered to a range of
    // count values. Each range gets a different fill color.
    var layers = [
        [150, '#f28cb1'],
        [20, '#f1f075'],
        [0, '#51bbd6']
    ];

    layers.forEach(function (layer, i) {
        map.addLayer({
            "id": "cluster-" + i,
            "type": "circle",
            "source": "earthquakes",
            "paint": {
                "circle-color": layer[1],
                "circle-radius": 18
            },
            "filter": i === 0 ?
                [">=", "point_count", layer[0]] :
                ["all",
                    [">=", "point_count", layer[0]],
                    ["<", "point_count", layers[i - 1][0]]]
        });
    });

    // Add a layer for the clusters' count labels
    map.addLayer({
        "id": "cluster-count",
        "type": "symbol",
        "source": "earthquakes",
        "layout": {
            "text-field": "{point_count}",
            "text-font": [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Bold"
            ],
            "text-size": 12
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
