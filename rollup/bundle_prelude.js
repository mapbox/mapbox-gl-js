// UMD bundle prelude
//
// Rollup's first pass splits GL JS into three AMD chunks:
//
//   1. shared  — define(['require', 'exports'], (require, exports) => { ... })
//      Common dependencies. We pass an empty object for 'exports'.
//
//   2. worker  — define(['require', './shared'], (require, shared) => { ... })
//      Worker script. Stringified into a Blob URL; never called on main thread.
//
//   3. main    — define(['./shared'], (shared) => { ... return mapboxgl })
//      Main GL JS module. Returns mapboxgl.
//
// The chunk order is fixed (shared → worker → main). Rollup adds the 'require' dep only to chunks
// that contain a dynamic import(), so arguments are mapped from the deps by name: 'require' gets
// undefined since we preserve dynamic imports, and both 'exports' and './shared' get the shared chunk.

let shared, sharedDeps, worker, workerDeps, mapboxgl;

// Use `self` to avoid mangling by downstream minifier
if (typeof self !== 'undefined') self.__mapboxImport = (u) => import(/* webpackIgnore: true */ /* @vite-ignore */ u);

function define(deps, chunk) {
    if (!shared) {
        shared = chunk;
        sharedDeps = deps;
    } else if (!worker) {
        worker = chunk;
        workerDeps = deps;
    } else {
        const sharedChunk = {};
        const args = (deps) => deps.map((dep) => (dep === 'require' ? undefined : sharedChunk));
        shared(...args(sharedDeps));
        mapboxgl = chunk(...args(deps));

        const argsString = (deps) => deps.map((dep) => (dep === 'require' ? 'undefined' : 'sharedChunk')).join(', ');
        const workerBundleString =
            "self.onerror = function() { console.error('An error occurred while parsing the WebWorker bundle. This is most likely due to improper transpilation by Babel; please see https://docs.mapbox.com/mapbox-gl-js/guides/install/#transpiling'); }; " +
            "var sharedChunk = {}; " +
            "self.__mapboxImport = (u) => import(u); " +
            "(" + shared + ")(" + argsString(sharedDeps) + "); " +
            "(" + worker + ")(" + argsString(workerDeps) + "); " +
            "self.onerror = null;";

        if (typeof window !== 'undefined' && window && window.URL && window.URL.createObjectURL) {
            mapboxgl.workerUrl = window.URL.createObjectURL(new Blob([workerBundleString], {type: 'text/javascript'}));
        }
    }
}
