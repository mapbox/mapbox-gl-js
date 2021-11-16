import puppeteer from 'puppeteer-core';
import fs from 'fs';
import zlib from 'zlib';
import {execSync} from 'child_process';

const mapboxGLJSSrc = fs.readFileSync('dist/mapbox-gl.js', 'utf8');
const mapboxGLCSSSrc = fs.readFileSync('dist/mapbox-gl.css', 'utf8');
const benchSrc = fs.readFileSync('bench/gl-stats.html', 'utf8');

const benchHTML = benchSrc
    .replace(/<script src="..\/dist\/mapbox-gl.js"><\/script>/, `<script>${mapboxGLJSSrc}</script>`)
    .replace('MAPBOX_ACCESS_TOKEN', process.env.MAPBOX_ACCESS_TOKEN);

function waitForConsole(page) {
    return new Promise((resolve) => {
        function onConsole(msg) {
            if (msg.type() !== 'log') {
                return;
            }

            page.removeListener('console', onConsole);
            resolve(msg.text());
        }
        page.on('console', onConsole);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        dumpio: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.CI ? '/usr/bin/google-chrome' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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
