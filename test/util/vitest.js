import {describe, test, expect, beforeEach, beforeAll, afterEach, afterAll, vi} from 'vitest';
import {Map} from '../../src/ui/map.js';
import {extend} from '../../src/util/util.js';

export function waitFor(evented, event) {
    return new Promise(resolve => {
        evented.once(event, resolve);
    });
}

export function createStyleJSON(options) {
    return {
        version: 8,
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
        return async (...args) => {
            try {
                await fn(...args, doneRef);
            } catch (err) {
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

export function createMap(options, callback) {
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

    if (!options || !options.skipCSSStub) vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    if (options && options.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));
    if (callback) {
        map.on('load', () => {
            callback(null, map);
        });
    }

    map._authenticate = () => {};

    return map;
}

export function equalWithPrecision(expected, actual, multiplier) {
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return expect(expectedRounded).toEqual(actualRounded);
}

export {describe, test, beforeEach, beforeAll, afterEach, afterAll, expect, vi};
