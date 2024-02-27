import {describe, test, expect} from "../util/vitest.js";
import mapboxgl from '../../src/index.js';

describe('mapboxgl', () => {
    test('version', () => {
        expect(mapboxgl.version).toBeTruthy();
        expect(mapboxgl.version).toMatch(/^3\.[0-9]+\.[0-9]+(-(dev|alpha|beta|rc)\.[1-9])?$/);
    });

    test('workerCount', () => {
        expect(typeof mapboxgl.workerCount === 'number').toBeTruthy();
        expect(mapboxgl.workerCount).toBe(2); // Test that workerCount defaults to 2
    });
});
