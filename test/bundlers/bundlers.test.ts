import http from 'node:http';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {globSync} from 'node:fs';
import serveStatic from 'serve-static';
import {chromium} from 'playwright';
import {test, describe, beforeAll, afterAll, expect} from 'vitest';

import type {Browser} from 'playwright';
import type {Map} from '../../src/ui/map';

declare global {
    interface Window {map: Map}
}

const ROOT = path.join(__dirname, '..', '..');
const TILES = path.join(ROOT, 'test', 'integration', 'tiles');
const PLUGIN_DISTS = globSync(path.join(ROOT, 'plugins', '*', 'dist'));
const testNames = globSync(path.join(__dirname, '*', 'package.json')).map((p) => path.basename(path.dirname(p))).sort();

function serve(roots: string[]): http.Server {
    const middlewares = roots.map((root: string) => serveStatic(root));
    return http.createServer((req, res) => {
        const notFound = () => { res.writeHead(404); res.end(); };
        const middleware = middlewares.reduceRight<() => void>((next, serve) => () => serve(req, res, next), notFound);
        middleware();
    });
}

let browser: Browser;

beforeAll(async () => {
    try {
        browser = await chromium.launch({channel: process.env.CI === 'true' ? 'chromium' : 'chrome'});
    } catch (e) {
        throw new Error(`Chromium failed to launch (is Playwright installed? in CI, run under xvfb): ${(e as Error).message}`, {cause: e});
    }
});

afterAll(async () => {
    if (browser) await browser.close();
});

describe.each(testNames)('%s', (bundler) => {
    const dir = path.join(__dirname, bundler);
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
        execSync(`npm run build -w test/bundlers/${bundler}`, {cwd: ROOT, stdio: 'inherit'});
        // Every project builds a self-contained page into dist/.
        server = serve([path.join(dir, 'dist'), ...PLUGIN_DISTS, TILES]);
        await new Promise<void>((resolve) => {
            server.listen(0, () => resolve());
        });

        port = (server.address() as {port: number}).port;
    });

    afterAll(async () => {
        if (server) await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    test('loads without errors', async () => {
        const tab = await browser.newPage();

        try {
            const errors: string[] = [];
            tab.on('pageerror', (e) => errors.push(e.message));
            tab.on('console', (m) => {
                if (m.type() === 'error') {
                    errors.push(m.text());
                }
            });

            await tab.goto(`http://localhost:${port}/index.html`);

            await tab.waitForFunction('window.map');
            const loaded = await tab.evaluate(() => {
                const map = window.map;
                if (map.loaded()) {
                    return true;
                }

                const signal = AbortSignal.timeout(10_000);
                return new Promise<boolean>((resolve) => {
                    map.on('load', () => {
                        resolve(true);
                    });

                    signal.addEventListener('abort', () => {
                        resolve(false);
                    });
                });
            });

            expect(errors).toEqual([]);
            expect(loaded, 'map did not load within 10s').toBe(true);
        } finally {
            try {
                await tab.close();
            } catch {
                /* a crashed tab must not mask the assertion */
            }
        }
    });
});
