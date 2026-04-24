// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, assert, beforeEach, beforeAll, afterEach, afterAll, vi} from 'vitest';
import {Map} from '../../src/ui/map';

export function waitFor(evented, event) {
    return new Promise(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        evented.once(event, resolve);
    });
}

export function createStyleJSON(options = {}) {
    return {
        version: 8 as const,
        sources: {},
        layers: [],
        ...options
    };
}

export function doneAsync() {
    const doneRef = {
        reject: null,
        resolve: null
    };

    const wait = new Promise((resolve, reject) => {
        doneRef.resolve = resolve;
        doneRef.reject = reject;
    });

    const withAsync = (fn) => {
        return (...args) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                return fn(...args, doneRef);
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                doneRef.reject(err);
            }
        };
    };

    return {
        wait,
        doneRef,
        withAsync
    };
}

const _createdMaps: Map[] = [];
let _testBaseline = 0;

// Called from `beforeEach` in test/unit/setup.ts to snapshot the map-registry
// length before each test. Any maps created during the test are above this
// baseline; `beforeAll`-owned shared maps sit below it and are preserved.
export function markTestBaseline() {
    _testBaseline = _createdMaps.length;
}

// Called from `afterEach` to remove maps created during the just-finished test.
// Triggers `loseContext()` via `Map.remove()` so the GPU-side WebGL context
// releases promptly instead of waiting on iframe GC. `prewarm()` in setup.ts
// keeps the shared worker pool alive across tests, so `release()` here is
// cheap (it only decrements the active-map set, doesn't terminate workers).
export function cleanupTestMaps() {
    for (let i = _createdMaps.length - 1; i >= _testBaseline; i--) {
        _createdMaps[i].remove();
    }
    _createdMaps.length = _testBaseline;
}

export function createMap(options?, callback?: (err: any, map: Map) => void) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        performanceMetricsCollection: false,
        trackResize: true,
        testMode: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    };

    Object.defineProperty(container, 'getBoundingClientRect',
        {value: () => ({height: 200, width: 200}), configurable: true});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!options || !options.skipCSSStub) vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options && options.deleteStyle) delete defaultOptions.style;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const map = new Map(Object.assign(defaultOptions, options));
    if (callback) {
        map.on('load', () => {
            callback(null, map);
        });
    }

    map._authenticate = () => {};
    _createdMaps.push(map);

    return map;
}

export function equalWithPrecision(expected, actual, multiplier) {
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return expect(expectedRounded).toEqual(actualRounded);
}

export {describe, test, beforeEach, beforeAll, afterEach, afterAll, expect, assert, vi};
