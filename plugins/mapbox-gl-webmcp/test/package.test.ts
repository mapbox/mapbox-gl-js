/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import ts from 'typescript';
import {rollup} from 'rollup';
import {build} from 'esbuild';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import {test, expect} from 'vitest';
import {tools} from '../src/tools/index';

const root = join(import.meta.dirname, '..');

function typeErrors(files: Record<string, string>, extraOptions: ts.CompilerOptions = {}): string[] {
    const {options: config} = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, {...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {}})!;
    const options = {...config, ...extraOptions, noEmit: true};
    const virtual = Object.fromEntries(Object.entries(files).map(([name, code]) => [join(root, 'test', name), code]));
    const host = ts.createCompilerHost(options);
    const {getSourceFile, fileExists} = host;
    host.fileExists = (name) => name in virtual || fileExists(name);
    host.getSourceFile = (name, version) => name in virtual ? ts.createSourceFile(name, virtual[name], version) : getSourceFile(name, version);
    const program = ts.createProgram(Object.keys(virtual), options, host);
    return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

test('the README examples type-check against the built package', () => {
    const examples = Array.from(readFileSync(join(root, 'README.md'), 'utf8').matchAll(/```ts\n([\s\S]*?)```/g), ([, code]) => code)
        .filter((code) => code.includes(`from '@mapbox/mapbox-gl-webmcp'`));
    const files = Object.fromEntries(examples.map((code, i) => [`readme_${i}.ts`, code]));
    files['readme_map.d.ts'] = `declare const map: import('mapbox-gl').Map;`;
    expect({examples: examples.length, errors: typeErrors(files)}).toEqual({examples: 3, errors: []});
});

test('a custom tool whose execute expects other input than its schema fails to type-check', () => {
    const code = `import mapboxgl from 'mapbox-gl';\nimport {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';\nnew MapboxWebMCP({mapboxgl, tools: {bad: {description: 'x', inputSchema: {type: 'object', properties: {a: {type: 'string'}}, required: ['a']}, execute(input: {a: string; b: number}) { return input.b.toFixed(); }}}});\n`;
    expect(typeErrors({'mismatched_tool.ts': code})).toEqual([expect.stringContaining("Property 'b' is missing")]);
});

test('the package type-checks under nodenext', () => {
    const code = `import mapboxgl from 'mapbox-gl';\nimport {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';\nimport {tools} from '@mapbox/mapbox-gl-webmcp/tools';\nnew MapboxWebMCP({mapboxgl, tools});\n`;
    expect(typeErrors({'nodenext.mts': code}, {module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: false, types: ['geojson']})).toEqual([]);
});

test.each(['mapbox-gl', 'mapbox-gl/esm'])('an app on %s type-checks', (entry) => {
    const code = `import * as mapboxgl from '${entry}';\nimport {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';\nimport {tools} from '@mapbox/mapbox-gl-webmcp/tools';\nconst map = new mapboxgl.Map({container: 'map'});\nmap.addControl(new MapboxWebMCP({mapboxgl, tools}));\n`;
    expect(typeErrors({'app.ts': code})).toEqual([]);
});

test('CommonJS apps can require the package and its tools', () => {
    const require = createRequire(join(root, 'test', 'app.cjs'));
    expect({
        control: Object.keys(require('@mapbox/mapbox-gl-webmcp') as object),
        tools: Object.keys(require('@mapbox/mapbox-gl-webmcp/tools') as object).sort()
    }).toEqual({control: ['MapboxWebMCP'], tools: ['camera', 'feature', 'layer', 'marker', 'popup', 'source', 'style', 'tools']});
});

test('the built files leave GL JS to the app', () => {
    expect(['mapbox-gl-webmcp.js', 'tools.js'].filter((file) => readFileSync(join(root, 'dist', file), 'utf8').includes(`'mapbox-gl'`))).toEqual([]);
});

async function bundleApp(entry: string): Promise<string> {
    const bundle = await rollup({
        input: 'entry',
        external: ['mapbox-gl'],
        plugins: [
            {name: 'entry', resolveId: (id) => (id === 'entry' ? id : null), load: (id) => (id === 'entry' ? entry : null)},
            nodeResolve({rootDir: root})
        ]
    });
    const [{code}] = (await bundle.generate({format: 'es'})).output;
    return code;
}

test('an esbuild bundle of the built files never builds code from strings, so it runs under a strict CSP', async () => {
    const contents = `import {MapboxWebMCP} from './dist/mapbox-gl-webmcp.js';\nimport {tools} from './dist/tools.js';\nconsole.log(MapboxWebMCP, tools);\n`;
    const {outputFiles: [{text}]} = await build({stdin: {contents, resolveDir: root}, bundle: true, write: false, format: 'esm', external: ['mapbox-gl'], logLevel: 'silent'});
    expect(text.match(/new Function|\bFunction\(|=\s*Function\b|\beval\(/g)).toBeNull();
});

test('a bundle that imports only camera has no other tool', async () => {
    const code = await bundleApp(`import {camera} from '@mapbox/mapbox-gl-webmcp/tools';\nconsole.log(camera);\n`);
    expect(Object.entries(tools).filter(([, {description}]) => code.includes(description)).map(([name]) => name)).toEqual(['camera']);
});
