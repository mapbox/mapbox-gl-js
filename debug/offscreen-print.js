importScripts('../dist/mapbox-gl-dev.js');
importScripts('../debug/access_token_generated.js');
self.requestAnimationFrame = function(callback) {
  return setTimeout(callback, 16);
};
self.cancelAnimationFrame = clearTimeout;
self.devicePixelRatio = 2;

onmessage = function(e) {
  self.devicePixelRatio = e.data.pixelRatio;
  const canvas = new OffscreenCanvas(e.data.width * e.data.dpi * self.devicePixelRatio, e.data.height * e.data.dpi * self.devicePixelRatio);
  var map = new mapboxgl.Map({
    container: canvas ,
    zoom: 12.5,
    center: [-122.4194, 37.7749],
    style: 'mapbox://styles/mapbox/streets-v10',
    hash: true
  });

  map.on('idle', () => {
    canvas.convertToBlob({type: 'image/png'}).then((blob) => {
        console.log(URL.createObjectURL(blob));
        postMessage({ renderResult: blob });
    });
  });
}