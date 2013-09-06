var DEBUG = true;

domready(function() {
    globalMap = new Map({
        container: document.getElementById('map'),
        urls: ['/gl/tiles/{z}-{x}-{y}.vector.pbf'],
        // urls: ['http://api.tiles.mapbox.com/dev/764e0b8d/{h}/{z}/{x}/{y}.vector.pbf'],
        zooms: [0, 2, 3, 4, 5, 6, 8, 10, 12, 14],
        zoom: 16,
        lat: 38.912753,
        lon: -77.032194,
        rotation: 0,
        style: style_json
    });
    new Debug(globalMap);
});
