/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const zlib = require('zlib');
const mapboxGLJSSrc = fs.readFileSync('dist/mapbox-gl.js', 'utf8');
const mapboxGLCSSSrc = fs.readFileSync('dist/mapbox-gl.css', 'utf8');
const benchSrc = fs.readFileSync('bench/gl-stats.html', 'utf8');
const {execSync} = require('child_process');

const benchHTML = benchSrc
    .replace(/<script src="..\/dist\/mapbox-gl.js"><\/script>/, `<script>${mapboxGLJSSrc}</script>`)
    .replace('MAPBOX_ACCESS_TOKEN', process.env.MAPBOX_ACCESS_TOKEN);

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
    stats["bundle_size"] = mapboxGLJSSrc.length + mapboxGLCSSSrc.length;
    stats["bundle_size_gz"] = zlib.gzipSync(mapboxGLJSSrc).length + zlib.gzipSync(mapboxGLCSSSrc).length;
    stats.dt = execSync('git show --no-patch --no-notes --pretty=\'%cI\' HEAD').toString().substring(0, 19);
    stats.commit = execSync('git rev-parse --short HEAD').toString().trim();
    stats.message = execSync('git show -s --format=%s HEAD').toString().trim();
    console.log(JSON.stringify(stats, null, 2));

    fs.writeFileSync('data.json.gz', zlib.gzipSync(JSON.stringify(stats)));

    await page.close();
    await browser.close();
})();
