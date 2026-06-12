const inlinedLibraries = [
    '@mapbox/mapbox-gl-supported',
    '@mapbox/point-geometry',
    '@mapbox/tiny-sdf',
    '@mapbox/vector-tile',
    'geojson',
    'gl-matrix',
    'kdbush',
    'pbf',
    'potpack',
];

const output = {noBanner: true, exportReferencedTypes: false};

/** @type {import('dts-bundle-generator/config-schema').BundlerConfig} */
module.exports = {
    compilationOptions: {preferredConfigPath: './tsconfig.browser.json'},
    entries: [
        {
            filePath: './src/index.ts',
            outFile: './dist/mapbox-gl.d.ts',
            libraries: {inlinedLibraries},
            output: Object.assign({umdModuleName: 'mapboxgl'}, output),
        },
        {
            filePath: './src/index.esm.ts',
            outFile: './dist/esm/mapbox-gl.d.ts',
            libraries: {inlinedLibraries},
            output,
        },
    ],
};
