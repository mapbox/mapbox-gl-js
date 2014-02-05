var DEBUG = true;
var ds;

domready(function() {
    globalMap = new llmr.Map({
        container: document.getElementById('map'),
        datasources: {
            "mapbox streets": {
                type: 'vector',
                id: 'streets',
                urls: ['/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'],
                urls: ['http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf'],
                zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14],
            },
        },
        maxZoom: 20,
        zoom: 17,
        lat: 36.202147,
        lon: 37.179309,
        rotation: 0,
        style: style_json,
        hash: true
    });


    var video = document.getElementById('skyboxvideo');
    video.style.display = 'none';
    video.muted = true;
    video.src = 'http://mapbox.s3.amazonaws.com/llmr-demo/aleppo.mp4';
    video.play();
    ds = new llmr.GeoJSONDatasource(aleppo, globalMap);
    globalMap.addDatasource('geojson', ds);

    globalMap.repaint = true;
    new Debug(globalMap);
});
