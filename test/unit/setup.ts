// @ts-nocheck
/* global globalThis */

import {toHaveBeenCalledBefore, toHaveBeenCalledAfter} from 'jest-extended';
import {expect} from '../util/vitest';

window.devicePixelRatio = 1;

// Load Error Handling
// https://vitejs.dev/guide/build#load-error-handling
window.addEventListener('vite:preloadError', (event) => {
    console.log('vite:preloadError', event);
    window.location.reload();
});

import mapboxgl from '../../src/index';

if (!globalThis.defined) {
    mapboxgl.workerParams = {
        type: 'module'
    };

    mapboxgl.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}

expect.extend({
    toHaveBeenCalledBefore,
    toHaveBeenCalledAfter
});
