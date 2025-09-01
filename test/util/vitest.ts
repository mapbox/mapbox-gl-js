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

    return map;
}

export function equalWithPrecision(expected, actual, multiplier) {
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return expect(expectedRounded).toEqual(actualRounded);
}

export {describe, test, beforeEach, beforeAll, afterEach, afterAll, expect, assert, vi};
