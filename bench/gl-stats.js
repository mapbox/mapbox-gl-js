/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const mapboxGlSrc = fs.readFileSync('dist/mapbox-gl.js', 'utf8');
const benchSrc = fs.readFileSync('bench/gl-stats.html', 'utf8');

const benchHTML = benchSrc.replace(/<script src="..\/dist\/mapbox-gl.js"><\/script>/, `<script>${mapboxGlSrc}</script>`);

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
