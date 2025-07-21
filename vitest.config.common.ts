import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import serveStatic from 'serve-static';
import {tilesets, staticFolders} from './test/integration/lib/middlewares.js';
import {getAllStyleFixturePaths, generateFixtureJson} from './test/integration/lib/generate-fixture-json.js';
import {getHTML} from './test/util/html_generator';

import type {Plugin} from 'vite';

function getShardedTests(suiteDir: string): string[] {
    const testFiles = getAllStyleFixturePaths(suiteDir);

    const shardId = parseInt(process.env.POOL_SHARD_ID || '0');
    const totalShards = parseInt(process.env.POOL_SHARDS || '1');
    const testsPerShard = Math.ceil(testFiles.length / totalShards);

    const start = shardId * testsPerShard;
    const end = Math.min(start + testsPerShard, testFiles.length);
    const shardedTests = testFiles.slice(start, end);

    return shardedTests;
}

export function integrationTests({suiteDirs, includeImages}: {suiteDirs: string[], includeImages?: boolean}): Plugin {
    if (!suiteDirs || suiteDirs.length === 0) {
        throw new Error('No suite directories specified');
    }

    const virtualModuleId = 'virtual:integration-tests';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;

    const allRenderTests = {};
    for (const dir of suiteDirs) {
        const testFiles = getShardedTests(dir);
        const dirTests = generateFixtureJson(dir, testFiles, includeImages);

        // Merge test cases, checking for conflicts
        for (const [testName, testData] of Object.entries(dirTests)) {
            if (allRenderTests[testName]) {
                throw new Error(
                    `Test name conflict: "${testName}" exists in multiple directories: ` +
                    `"${allRenderTests[testName].path}" and "${testData.path}"`
                );
            }
            allRenderTests[testName] = testData;
        }
    }

    return {
        name: 'integration-tests',
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `export const integrationTests = ${JSON.stringify(allRenderTests)};`;
            }
        }
    };
}

export function setupIntegrationTestsMiddlewares({reportPath}: {reportPath: string}): Plugin {
    return {
        name: 'setup-integration-tests-middlewares',
        configureServer(server) {
            const reportFragmentsMap = new Map<number, string>();
            staticFolders.forEach((folder) => {
                server.middlewares.use(`/${folder}`, serveStatic(resolve(__dirname, `test/integration/${folder}`)));
                const internalPath = resolve(__dirname, `internal/test/integration/${folder}`);
                if (existsSync(internalPath)) server.middlewares.use(`/${folder}`, serveStatic(internalPath));
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

                writeFile(reportPath, getHTML(statsContent, testsContent)).catch((err) => {
                    console.error('Error writing report file:', err);
                });
            });

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            server.middlewares.use('/tilesets', tilesets);
            server.middlewares.use('/mapbox-gl-styles', serveStatic(resolve(__dirname, 'node_modules/mapbox-gl-styles')));
            server.middlewares.use('/mvt-fixtures', serveStatic(resolve(__dirname, 'node_modules/@mapbox/mvt-fixtures')));
        }
    };
}
