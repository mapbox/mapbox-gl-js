/* global globalThis */

import mapboxgl from '../../src/index';

if (!globalThis.defined) {
    mapboxgl.workerParams = {
        type: 'module'
    };

    mapboxgl.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}
