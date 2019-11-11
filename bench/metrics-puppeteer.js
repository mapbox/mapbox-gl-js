/* eslint-disable import/no-commonjs */

const puppeteer = require('puppeteer');
const fs = require('fs');
const zlib = require('zlib');
const mapboxGLJSSrc = fs.readFileSync('dist/mapbox-gl-dev.js', 'utf8');
const mapboxMetricsSrc = fs.readFileSync('bench/dist/metrics-suite.js', 'utf8');
const benchSrc = fs.readFileSync('bench/metrics.html', 'utf8');
const {execSync} = require('child_process');

const benchHTML = benchSrc
    .replace(/<script src=".\/dist\/metrics-suite.js"><\/script>/, `<script>${mapboxMetricsSrc}</script>`)
    .replace(/<script src="..\/dist\/mapbox-gl-dev.js"><\/script>/, `<script>${mapboxGLJSSrc}</script>`);

// function waitForConsole(page) {
//     return new Promise((resolve) => {
//         function onConsole(msg) {
//             page.removeListener('console', onConsole);
//             resolve(msg.text());
//         }
//         page.on('console', onConsole);
//     });
// }

async function countInstancesInMemory(page, prototype) {
    // Query all buffer instances into an array
    const instances = await page.queryObjects(prototype);
    // Count amount of buffer objects in heap
    const count = await page.evaluate((buffers) => buffers.length, instances);
    await instances.dispose();
    await prototype.dispose();

    return count;
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const messages = [];

    // console.log('collecting stats...');
    await page.setViewport({width: 600, height: 600, deviceScaleFactor: 2});
    await page.setContent(benchHTML);

    const onConsole = async (msg) => {
        // Get a handle to the ArrayBuffer object prototype
        const arrayBufferPrototype = page.evaluateHandle(() => ArrayBuffer.prototype);
        const arrayBufferCount = countInstancesInMemory(page, arrayBufferPrototype);

        // Get a handle to the Object prototype
        const objectPrototype = page.evaluateHandle(() => Object.prototype);
        const objectCount = countInstancesInMemory(page, objectPrototype);

        const metrics = page.metrics();
        const promises = Promise.all([arrayBufferPrototype, arrayBufferCount, objectPrototype, objectCount, metrics]);

        promises.then((output) => {
            messages.push(output);
        });

        if (msg.text() === 'exit') {
            fs.writeFileSync('bench/dist/metrics-log.txt', JSON.stringify(messages));
            await page.close();
            await browser.close();
        } else {
            messages.push(msg.text());
        }
    };
    page.on('console', onConsole);
    // const stats = JSON.parse(await waitForConsole(page));
    // stats["bundle_size"] = mapboxGLJSSrc.length + mapboxGLCSSSrc.length;
    // stats["bundle_size_gz"] = zlib.gzipSync(mapboxGLJSSrc).length + zlib.gzipSync(mapboxGLCSSSrc).length;
    // stats.dt = execSync('git show --no-patch --no-notes --pretty=\'%cI\' HEAD').toString().substring(0, 19);
    // stats.commit = execSync('git rev-parse --short HEAD').toString().trim();
    // stats.message = execSync('git show -s --format=%s HEAD').toString().trim();
    // console.log(JSON.stringify(stats, null, 2));
    //
    // fs.writeFileSync('data.json.gz', zlib.gzipSync(JSON.stringify(stats)));
})();
