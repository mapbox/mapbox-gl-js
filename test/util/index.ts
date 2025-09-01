// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {Map} from '../../src/ui/map';

export function createMap(t, options, callback) {
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (!options || !options.skipCSSStub) t.stub(Map.prototype, '_detectMissingCSS');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (options && options.deleteStyle) delete defaultOptions.style;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const map = new Map(Object.assign(defaultOptions, options));
    if (callback) map.on('load', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null, map);
    });

    map._authenticate = () => {};

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return test.equal(expectedRounded, actualRounded, message, extra);
}
