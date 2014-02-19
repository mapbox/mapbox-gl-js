var DEBUG = true;

domready(function() {
    globalMap = new llmr.Map({
        container: document.getElementById('map'),
        sources: {
            "mapbox streets": {
                type: 'vector',
                id: 'streets',
                urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'],
                zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            }
        },
        maxZoom: 20,
        zoom: 15,
        lat: 37.76,
        lon: -122.45,
        rotation: 0,
        style: style_json,
        hash: true
    });
    new Debug(globalMap);
});
