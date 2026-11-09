/** @typedef {typeof import('../../../src/index').default} MapboxGL */

/** @type {MapboxGL} */
export let mapboxgl;

// The UMD bundles install `mapboxgl` on the global object.
const globalWithMapboxgl = /** @type {typeof globalThis & {mapboxgl: MapboxGL}} */ (globalThis);

let modulePath;

if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'csp') {
    modulePath = '../../../dist/mapbox-gl-csp.js';
    await import(/* @vite-ignore */ modulePath);

    mapboxgl = globalWithMapboxgl.mapboxgl;
    mapboxgl.workerUrl = '/dist/mapbox-gl-csp-worker.js';
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'prod') {
    modulePath = '../../../dist/mapbox-gl.js';
    await import(/* @vite-ignore */ modulePath);

    mapboxgl = globalWithMapboxgl.mapboxgl;
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'dev') {
    modulePath = '../../../dist/mapbox-gl-dev.js';
    await import(/* @vite-ignore */ modulePath);

    mapboxgl = globalWithMapboxgl.mapboxgl;
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'esm') {
    modulePath = '../../../dist/esm-dev/mapbox-gl.js';
    mapboxgl = await import(/* @vite-ignore */ modulePath);
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'esm-prod') {
    modulePath = '../../../dist/esm/mapbox-gl.js';
    mapboxgl = await import(/* @vite-ignore */ modulePath);
} else {

    mapboxgl = globalWithMapboxgl.mapboxgl;
}
