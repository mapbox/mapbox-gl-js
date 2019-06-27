/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const mapboxGlSrc = fs.readFileSync('dist/mapbox-gl.js', 'utf8');

const benchHTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script>${mapboxGlSrc}</script>
<link rel="stylesheet" href="dist/mapbox-gl.css">
</head>
<body style="margin: 0; padding: 0"><div id="map" style="width: 500px; height: 500px"></div></body>
<script>
mapboxgl.accessToken = 'pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA';
mapboxgl.workerCount = 1;

var map = new mapboxgl.Map({
    container: document.getElementById('map'),
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-77.07842066675323, 38.890315130853566],
    zoom: 11.1
});

const gl = map.painter.context && map.painter.context.gl || map.painter.gl;

let bufferDataTotal = 0;

const originalBufferData = gl.bufferData;
gl.bufferData = function (target, data, usage) {
    bufferDataTotal += data.byteLength;
    originalBufferData.call(gl, target, data, usage);
};

map.on('render', () => {
    if (!map._sourcesDirty && !map._repaint && !map._styleDirty && !map._placementDirty && map.loaded()) {
        console.log(JSON.stringify({'buffer-data': bufferDataTotal}));
    }
});
</script>
</html>`;

function waitForConsole(page) {
    return new Promise((resolve) => {
        function onConsole(msg) {
            page.removeListener('console', onConsole);
            resolve(msg.text());
        }
        page.on('console', onConsole);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log('collecting stats...');
    await page.setViewport({width: 600, height: 600, deviceScaleFactor: 2});
    await page.setContent(benchHTML);

    const stats = JSON.parse(await waitForConsole(page));
    console.log(JSON.stringify(stats, null, 2));

    await page.close();
    await browser.close();
})();
