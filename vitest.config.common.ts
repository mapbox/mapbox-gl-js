import {resolve} from 'node:path';
import {writeFileSync, mkdirSync, existsSync, readFileSync} from 'node:fs';
import {type Plugin} from 'vite';
import serveStatic from 'serve-static';
import {tilesets, staticFolders} from './test/integration/lib/middlewares.js';
import {generateFixtureJson} from './test/integration/lib/generate-fixture-json.js';
import {getHTML} from './test/util/html_generator';

export function setupIntegrationTestsMiddlewares(type: string): Plugin {
    return {
        name: 'setup-integration-tests-middlewares',
        configureServer(server) {
            const reportFragmentsMap = new Map<number, string>();
            staticFolders.forEach((folder) => {
                server.middlewares.use(`/${folder}`, serveStatic(resolve(__dirname, `test/integration/${folder}`)));
            });
            server.middlewares.use('/report-html/send-fragment', (req, res) => {
                let body = '';

                req.on('data', (data) => {
                    body += data;
                });

                return req.on('end', () => {
                    const {id, data} = JSON.parse(body);
                    reportFragmentsMap.set(id, Buffer.from(data, 'base64').toString());
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({status: 'ok'}));
                });
            });
            server.middlewares.use('/report-html/flush', (req, res) => {
                const statsContent = reportFragmentsMap.get(0);
                const testsContent = Array.from(reportFragmentsMap.entries()).sort((a, b) => a[0] - b[0]).map((r) => r[1]).slice(1).join('');
                reportFragmentsMap.clear();
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({status: 'ok'}));
                mkdirSync(`test/integration/${type}-tests/vitest`, {recursive: true});
                writeFileSync(`test/integration/${type}-tests/vitest/tests.html`, getHTML(statsContent, testsContent));
            });

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            server.middlewares.use('/tilesets', tilesets);
            server.middlewares.use('/mapbox-gl-styles', serveStatic(resolve(__dirname, 'node_modules/mapbox-gl-styles')));
            server.middlewares.use('/mvt-fixtures', serveStatic(resolve(__dirname, 'node_modules/@mapbox/mvt-fixtures')));
        }
    };
}

export function integrationTests(type: string, includeImages: boolean = true): Plugin {
    let testFiles;
    const testsToRunFile = "tests-to-run.txt";

    if (existsSync(testsToRunFile)) {
        try {
            let file = readFileSync(testsToRunFile, 'utf8');
            // Remove BOM header which is written on Windows
            file = file.replace(/^\uFEFF/, '').trim();
            // Convert windows to linux paths. Even on windows, we use path.posix for consisten path syntax.
            file = file.replace(/^\uFEFF/, '').replace(/\\/g, '/');
            testFiles = file.split(/\r?\n/);
        } catch (err) {
            console.error(`Failed to read file ${testsToRunFile}: ${err}`);
        }
    }

    const virtualModuleId = 'virtual:integration-tests';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;
    const allRenderTests = generateFixtureJson(
        'test/integration/',
        `${type}-tests`,
        'test/integration/dist',
        includeImages,
        testFiles,
    );

    return {
        name: 'integration-tests',
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `export const integrationTests = ${JSON.stringify(allRenderTests)}`;
            }
        }
    };
}
