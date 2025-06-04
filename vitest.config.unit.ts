import {basename as pathBasename} from 'node:path';
import {readFileSync} from 'node:fs';
import {mergeConfig, defineConfig} from 'vitest/config';
import {globSync} from 'glob';
import baseConfig from './vitest.config.base';

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
    test: {
        browser: {
            instances: [
                {browser: 'chromium'},
            ],
        },
        include: ['test/unit/**/*.test.ts'],
        setupFiles: ['test/unit/setup.ts'],
        reporters: process.env.CI ? [
            ['html', {outputFile: './test/unit/vitest/index.html'}],
            ['junit', {outputFile: './test/unit/test-results.xml'}],
            ['default', {summary: false}]
        ] : [['default', {summary: false}]],
    },
    plugins: [
        styleSpecFixtures()
    ]
}));
