export let mapboxgl;

let modulePath;

if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'csp') {
    modulePath = '../../../dist/mapbox-gl-csp.js';
    await import(/* @vite-ignore */ modulePath);
    // eslint-disable-next-line no-undef
    mapboxgl = globalThis.mapboxgl;
    mapboxgl.workerUrl = '/dist/mapbox-gl-csp-worker.js';
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'prod') {
    modulePath = '../../../dist/mapbox-gl.js';
    await import(/* @vite-ignore */ modulePath);
    // eslint-disable-next-line no-undef
    mapboxgl = globalThis.mapboxgl;
} else if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_DIST_BUNDLE === 'dev') {
    modulePath = '../../../dist/mapbox-gl-dev.js';
    await import(/* @vite-ignore */ modulePath);
    // eslint-disable-next-line no-undef
    mapboxgl = globalThis.mapboxgl;
} else {
    // eslint-disable-next-line no-undef
    mapboxgl = globalThis.mapboxgl;
}
