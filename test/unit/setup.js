import {toHaveBeenCalledBefore, toHaveBeenCalledAfter} from 'jest-extended';
import {expect} from '../util/vitest.js';
import mapboxgl from '../../src/index.js';

mapboxgl.workerParams = {
    type: "module"
};

mapboxgl.workerUrl = '/src/source/worker.js';

expect.extend({
    toHaveBeenCalledBefore,
    toHaveBeenCalledAfter
});
