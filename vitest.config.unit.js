/* eslint-disable flowtype/require-valid-file-annotation */
import {readFileSync} from 'node:fs';
import {basename as pathBasename} from 'node:path';

import {mergeConfig, defineConfig} from 'vite';
import {globSync} from 'glob';
import baseConfig from './vitest.config.base.js';

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
        include: ['test/unit/**/*.test.js'],
        setupFiles: ['test/unit/setup.js'],
    },
    publicDir: 'test/util',
    plugins: [
        styleSpecFixtures()
    ]
}));
