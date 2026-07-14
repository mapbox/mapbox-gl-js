const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const serveStatic = require('serve-static');
const {chromium} = require('playwright');

const TILES = path.join(__dirname, '..', 'integration', 'tiles');
const PROVIDER_DIST = path.join(__dirname, '..', '..', 'plugins', 'mapbox-gl-pmtiles-provider', 'dist');

function serve(root) {
    const middlewares = [serveStatic(root), serveStatic(PROVIDER_DIST), serveStatic(TILES)];
    return http.createServer((req, res) => {
        const notFound = () => { res.writeHead(404); res.end(); };
        const middleware = middlewares.reduceRight((next, serve) => () => serve(req, res, next), notFound);
        middleware();
    });
}

async function expectNoErrors(browser, port, file) {
    const tab = await browser.newPage();
    try {
        const errors = [];
        tab.on('pageerror', (e) => errors.push(e.message));
        tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await tab.goto(`http://localhost:${port}/${file}`);
        const gotTiles = await tab.waitForResponse((r) => r.url().endsWith('.pmtiles'), {timeout: 8000}).then(() => true, () => false);
        // A broken worker import surfaces just after the .pmtiles fetch; let it flush.
        await tab.waitForTimeout(100);
        assert.deepEqual(errors, []);
        assert.ok(gotTiles, 'page produced no .pmtiles request within 8s');
    } finally {
        try { await tab.close(); } catch { /* a crashed tab must not mask the assertion */ }
    }
}

function testPages({label, root, files}) {
    let browser, server, port;
    test.before(async () => {
        server = serve(root);
        await new Promise((resolve) => server.listen(0, resolve));
        ({port} = server.address());
        try {
            // CI installs full chromium via `playwright install --no-shell`; match vitest.config.base.ts.
            browser = await chromium.launch({channel: process.env.CI === 'true' ? 'chromium' : 'chrome'});
        } catch (e) {
            throw new Error(`Chromium failed to launch (is Playwright installed? in CI, run under xvfb): ${e.message}`);
        }
    });
    test.after(async () => {
        if (browser) await browser.close();
        if (server) await new Promise((resolve) => server.close(resolve));
    });
    for (const file of files) {
        const name = file.replace('.html', '');
        test(`${label}-${name} build loads a PMTiles source without errors`, {timeout: 15000}, () => expectNoErrors(browser, port, file));
    }
}

module.exports = {testPages};
