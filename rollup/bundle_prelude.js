// UMD bundle prelude
//
// Rollup's first pass splits GL JS into three AMD chunks:
//
//   1. shared  — define(['exports'], (exports) => { ... })
//      Common dependencies. We pass an empty object for 'exports'.
//
//   2. worker  — define(['require', './shared'], (require, shared) => { ... })
//      Worker script. Stringified into a Blob URL; never called on main thread.
//      The 'require' dep is injected by Rollup because the worker chunk
//      contains a dynamic import(). We pass undefined for 'require' since
//      we preserve dynamic imports.
//
//   3. main    — define(['./shared'], (shared) => { ... return mapboxgl })
//      Main GL JS module. Returns mapboxgl.
//
// The chunk order is fixed (shared → worker → main) and deps are statically
// known, so we hardcode argument positions and ignore the deps arrays entirely.

let shared, worker, mapboxgl;

function define(_, chunk) {
    if (!shared) {
        shared = chunk;
    } else if (!worker) {
        worker = chunk;
    } else {
        const sharedChunk = {};
        shared(sharedChunk);
        mapboxgl = chunk(sharedChunk);

        const workerBundleString =
            "self.onerror = function() { console.error('An error occurred while parsing the WebWorker bundle. This is most likely due to improper transpilation by Babel; please see https://docs.mapbox.com/mapbox-gl-js/guides/install/#transpiling'); }; " +
            "var sharedChunk = {}; " +
            "(" + shared + ")(sharedChunk); " +
            "(" + worker + ")(undefined, sharedChunk); " +
            "self.onerror = null;";

        if (typeof window !== 'undefined' && window && window.URL && window.URL.createObjectURL) {
            mapboxgl.workerUrl = window.URL.createObjectURL(new Blob([workerBundleString], {type: 'text/javascript'}));
        }
    }
}
