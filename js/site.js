var DEBUG = true;

domready(function() {
    globalMap = new Map({
        container: document.getElementById('map'),
        //urls: ['/gl/tiles/{z}-{x}-{y}.vector.pbf'],
        // urls: ['http://api.tiles.mapbox.com/dev/764e0b8d/{h}/{z}/{x}/{y}.vector.pbf'],
        urls: ['http://a.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf'],
        zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
        zoom: 15,
        lat: 38.912753,
        lon: -77.032194,
        rotation: 0,
        style: style_json
    });
    new Debug(globalMap);
});
