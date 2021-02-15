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
        // this token is a fallback for CI and testing. it is domain restricted to localhost
        accessToken: 'pk.eyJ1IjoibWFwYm94LWdsLWpzIiwiYSI6ImNram9ybGI1ajExYjQyeGxlemppb2pwYjIifQ.LGy5UGNIsXUZdYMvfYRiAQ',
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    };

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (!options || !options.skipAuthenticateStub) t.stub(Map.prototype, '_authenticate');
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
