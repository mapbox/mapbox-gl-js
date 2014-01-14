var DEBUG = true;

domready(function() {
    globalMap = new llmr.Map({
        container: document.getElementById('map'),
        datasources: {
            'streets': {
                type: 'vector',
                urls: ['/gl/tiles/terrain/{z}-{x}-{y}.vector.pbf'],
                zooms: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            }
        },
        maxZoom: 20,
        zoom: 13,
        lat: 37.772537,
        lon: -122.420679,
        rotation: 0,
        style: style_json,
        hash: true
    });
    new Debug(globalMap);
});
