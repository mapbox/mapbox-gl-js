'use strict';

const puppeteer = require('puppeteer'); // eslint-disable-line
const path = require('path'); // eslint-disable-line
const pack = require('../../package.json'); // eslint-disable-line

const fileName = process.argv[2];
const token = process.argv[3] || process.env.MAPBOX_ACCESS_TOKEN;

if (!token || !fileName) {
    throw new Error('\n  Usage: npm run create-image <file-name> <mapbox-access-token>\nExample: npm run create-image 3d-buildings pk000011110000111100001111\n\n');
}

// strip file extension from file name
const fileNameFormatted = fileName.replace('.html', '').replace('.js', '');
// get the example contents/snippet
const snippet = require('fs').readFileSync(path.resolve(__dirname, '..', 'pages', 'example', `${fileNameFormatted}.html`), 'utf-8');
// create an HTML page to display the example snippet
const html = `<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8' />
<meta name='viewport' content='initial-scale=1,maximum-scale=1,user-scalable=no' />
<script src='https://api.tiles.mapbox.com/mapbox-gl-js/v${pack.version}/mapbox-gl.js'></script>
<link href='https://api.tiles.mapbox.com/mapbox-gl-js/v${pack.version}/mapbox-gl.css' rel='stylesheet' />
<style>
body { margin:0; padding:0; }
#map { position: absolute; top:0; bottom:0; width: 1200px; max-height: 600px; }
</style>
</head>
<body>
<script>
mapboxgl.accessToken = '${token}';
</script>
${snippet}
</body>
</html>`;

// initilize puppeteer
(async() => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, {waitUntil: 'networkidle2'});
    // create screenshot
    await page.screenshot({
        path: `./docs/img/src/${fileNameFormatted}.png`,
        type: 'png',
        clip: {
            x: 0,
            y: 0,
            width: 1200,
            height: 500
        }
    }).then(() => console.log(`Created ./docs/img/src/${fileNameFormatted}.png`))
        .catch((err) => { console.log(err); });
    await browser.close();
})();
