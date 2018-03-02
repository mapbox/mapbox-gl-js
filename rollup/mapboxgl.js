//
// Our custom intro provides a specialized "define()" function, called by the
// AMD modules below, that sets up the worker blob URL and then executes the
// main module, storing its exported value as 'mapboxgl'

// The three "chunks" imported here are produced by a first Rollup pass,
// which outputs them as AMD modules.

// Shared dependencies, i.e.:
/*
define(['exports'], function (exports) {
    // Code for all common dependencies
    // Each module's exports are attached attached to 'exports' (with
    // names rewritten to avoid collisions, etc.)
})
*/
import './build/chunk1';

// Worker and its unique dependencies, i.e.:
/*
define(['./chunk1.js'], function (__chunk1__js) {
    //  Code for worker script and its unique dependencies.
    //  Expects the output of 'chunk1' module to be passed in as an argument,
    //  since all references to common deps look like, e.g.,
    //  __chunk1__js.shapeText().
});
*/
// When this wrapper function is passed to our custom define() above,
// it gets stringified, together with the chunk1 wrapper (using
// Function.toString()), and the resulting string of code is made into a
// Blob URL that gets used by the main module to create the web workers.
import './build/worker';

// Main module and its unique dependencies
/*
define(['./chunk1.js'], function (__chunk1__js) {
    //  Code for main GL JS module and its unique dependencies.
    //  Expects the output of 'chunk1' module to be passed in as an argument,
    //  since all references to common deps look like, e.g.,
    //  __chunk1__js.shapeText().
    //
    //  Returns the actual mapboxgl (i.e. src/index.js)
});
*/
import './build/index';

export default mapboxgl;
