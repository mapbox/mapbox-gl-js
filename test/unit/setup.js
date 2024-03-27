/* global globalThis */

import {toHaveBeenCalledBefore, toHaveBeenCalledAfter} from 'jest-extended';
import {expect} from '../util/vitest.js';
import mapboxgl from '../../src/index.js';

if (!globalThis.defined) {
    mapboxgl.workerParams = {
        type: "module"
    };

    mapboxgl.workerUrl = '/src/source/worker.js';

    globalThis.defined = true;
}

expect.extend({
    toHaveBeenCalledBefore,
    toHaveBeenCalledAfter
});
