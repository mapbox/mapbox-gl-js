import {basename} from 'path';
import {readFileSync} from 'fs';
import virtual from '@rollup/plugin-virtual';
import {globSync} from 'glob';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig from './vitest.config.base';
import {ignores} from './test/usvg/ignores';

// base64 encoded PNG fixtures
const fixtures = globSync('./test/usvg/test-suite/*.png').reduce((acc, pngPath) => {
    const name = basename(pngPath, '.png');
    const base64Data = readFileSync(pngPath, 'base64');
    acc[name] = base64Data;
    return acc;
}, {});

export default mergeConfig(baseConfig, defineConfig({
    test: {
        retry: 0,
        include: ['./test/usvg/*.test.ts'],
        setupFiles: ['./test/usvg/setup.ts'],
        reporters: process.env.CI ?
            [['junit', {outputFile: './test/usvg/test-results.xml'}], ['basic']] :
            ['basic'],
    },
    plugins: [
        virtual({
            'virtual:usvg-fixtures': `export const fixtures = ${JSON.stringify(fixtures)}; export const ignores = ${JSON.stringify(ignores)}`
        })
    ]
}));
