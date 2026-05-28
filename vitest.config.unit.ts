import {basename as pathBasename} from 'node:path';
import {readFileSync, globSync} from 'node:fs';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig, {isCI, chromiumBrowser} from './vitest.config.base';

import type {Reporter} from 'vitest/reporters';
import type {TestProject} from 'vitest/node';

// Long browser-mode runs accumulate detached iframe state in the orchestrator
// renderer, eventually crashing it as a flaky `Browser connection was closed`.
// V8 doesn't run major GC often enough on the orchestrator to release it (low
// heap pressure: ~30 MB live set vs 4 GB limit). Force a major GC every 5s via
// CDP. Upstream root cause is a closure pin in vitest's `IframeOrchestrator`.
type CDP = {send: (m: string, p?: object) => Promise<unknown>};
type Provider = {
    pages: Map<string, unknown>;
    getCDPSession: (id: string) => Promise<CDP>;
};

function orchestratorGCReporter(): Reporter {
    let interval: NodeJS.Timeout | null = null;
    return {
        onInit(vitest: {projects: TestProject[]}) {
            let cdp: CDP | null = null;
            const tick = async () => {
                if (!cdp) {
                    const project = vitest.projects.find((p) => (p.browser as unknown as {provider?: Provider})?.provider);
                    const provider = project && (project.browser as unknown as {provider: Provider}).provider;
                    const sessionId = provider?.pages.keys().next().value;
                    if (!provider || !sessionId) return;
                    cdp = await provider.getCDPSession(sessionId);
                }
                await cdp.send('HeapProfiler.collectGarbage');
            };
            interval = setInterval(() => { tick().catch(() => { cdp = null; }); }, 5000);
            interval.unref?.();
        },
        onTestRunEnd() {
            if (interval) clearInterval(interval);
            interval = null;
        },
    };
}

function styleSpecFixtures() {
    const virtualModuleId = 'virtual:style-spec/fixtures';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;
    const fixtureFiles = globSync('./test/unit/style-spec/fixture/*.input.json').reduce((acc, file) => {
        acc[pathBasename(file).replace('.input.json', '')] = readFileSync(file).toString();
        return acc;
    }, {});

    return {
        name: 'style-spec-fixtures',
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `export const fixtures = ${JSON.stringify(fixtureFiles)}`;
            }
        }
    };
}

export default mergeConfig(baseConfig, defineConfig({
    // Forbid Vite's on-demand dep discovery so it can't reload the page mid-run.
    // Only CJS deps (those needing ESM interop) must be listed; pure-ESM deps
    // work without it.
    optimizeDeps: {
        noDiscovery: true,
        include: [
            '@mapbox/mapbox-gl-supported',
            'csscolorparser',
            'vitest > expect-type',
        ],
    },
    test: {
        browser: chromiumBrowser(),
        include: ['test/unit/**/*.test.ts'],
        setupFiles: ['test/unit/setup.ts'],
        reporters: isCI ? [
            ['html', {outputFile: './test/unit/vitest/index.html'}],
            ['github-actions'],
            orchestratorGCReporter(),
        ] : [orchestratorGCReporter()],
    },
    plugins: [
        styleSpecFixtures()
    ]
}));
