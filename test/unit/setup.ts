// @ts-nocheck
/* global globalThis */

import {toHaveBeenCalledBefore, toHaveBeenCalledAfter} from 'jest-extended';
import {expect} from '../util/vitest';
import mapboxgl from '../../src/index';

if (!globalThis.defined) {
    mapboxgl.workerParams = {
        type: "module"
    };

    mapboxgl.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}

expect.extend({
    toHaveBeenCalledBefore,
    toHaveBeenCalledAfter
});
