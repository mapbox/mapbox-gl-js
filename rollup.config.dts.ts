import fs from 'fs';
import {dts} from 'rollup-plugin-dts';

import type {Plugin, RollupOptions} from 'rollup';

// Type declarations from these dependencies are inlined into the bundled `.d.ts`
// output rather than left as bare `import`s, so consumers don't need the packages
// installed to typecheck against mapbox-gl. Everything else stays external.
const inlinedLibraries = [
    '@mapbox/mapbox-gl-supported',
    '@mapbox/point-geometry',
    '@mapbox/tiny-sdf',
    '@mapbox/vector-tile',
    'geojson',
    'geojson-vt',
    'gl-matrix',
    'kdbush',
    'pbf',
    'potpack',
];

function packageName(id: string): string {
    const parts = id.split('/');
    return id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function external(id: string): boolean {
    // Relative/absolute imports are part of our own graph and must be bundled.
    if (id.startsWith('.') || id.startsWith('/')) return false;
    return !inlinedLibraries.includes(packageName(id));
}

// gl-matrix ships its types wrapped in an ambient `declare module "gl-matrix" {...}`
// block, which rollup-plugin-dts can't treat as a real module. Strip the wrapper so
// its exports become visible for inlining.
function unwrapGlMatrix(): Plugin {
    return {
        name: 'unwrap-gl-matrix',
        load(id) {
            if (!id.endsWith('gl-matrix/index.d.ts')) return null;
            const code = fs.readFileSync(id, 'utf8');
            return code.replace(/declare module "gl-matrix" \{/, '').replace(/\}\s*$/, '');
        }
    };
}

function dtsConfig(input: string, file: string, umd: boolean): RollupOptions {
    return {
        input,
        output: {
            file,
            format: 'es',
            // The UMD entry declares a global `mapboxgl` namespace for script-tag users.
            footer: umd ? 'export as namespace mapboxgl;' : undefined,
        },
        external,
        plugins: [
            unwrapGlMatrix(),
            dts({respectExternal: true, tsconfig: './tsconfig.browser.json'}),
        ],
    };
}

export default (): RollupOptions[] => [
    dtsConfig('src/index.ts', 'dist/mapbox-gl.d.ts', true),
    dtsConfig('src/index.esm.ts', 'dist/esm/mapbox-gl.d.ts', false),
];
