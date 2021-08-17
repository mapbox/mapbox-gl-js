import window from '../../src/util/window.js';
import Map from '../../src/ui/map.js';
import {extend} from '../../src/util/util.js';

export function createMap(t, options, callback) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        testMode: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    };

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});
    Object.defineProperty(container, 'getBoundingClientRect', {value:
        () => {
            return {
                bottom: 0,
                height: 200,
                left: 0,
                right: 0,
                top: 0,
                width: 200,
                x: 0,
                y: 0
            };
        },
    configurable: true
    });

    if (!options || !options.skipCSSStub) t.stub(Map.prototype, '_detectMissingCSS');
    if (options && options.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));
    if (callback) map.on('load', () => {
        callback(null, map);
    });

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}
