importScripts('../dist/mapbox-gl-dev.js');
importScripts('../debug/access_token_generated.js');
var window = {}
window.requestAnimationFrame = function(fn) {
    setTimeout(() => {
        fn(performance.now());
    }, 33);
}

self.requestAnimationFrame = function(fn) {
    setTimeout(() => {
        fn(performance.now());
    }, 33);
}

onmessage = function(e) {
    const canvas = new OffscreenCanvas(1000, 1000);

    var map = new mapboxgl.Map({
        container: canvas ,
        zoom: 12.5,
        center: [-122.4194, 37.7749],
        style: 'mapbox://styles/mapbox/streets-v10',
        hash: true
    });

    map.on('idle', () => {
        canvas.convertToBlob({type: 'image/png'}).then((blob) => {
            postMessage({ renderResult: blob });
        })
    });
}