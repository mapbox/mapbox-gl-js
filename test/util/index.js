import window from '../../src/util/window';
import Map from '../../src/ui/map';
import {extend} from '../../src/util/util';

export function createStyle() {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {
            mock: {
                type: 'geojson',
                data:{
                    type: "FeatureCollection",
                    features: [
                        {
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "Point",
                                coordinates: [ 0, 0 ]
                            }
                        }
                    ]
                }
            }
        },
        layers: [{
            id: 'mock-point',
            source: 'mock',
            type: 'symbol'
        }]
    };
}

export function createMap(t, options, callback, styleLoadCallback) {
    const container = window.document.createElement('div');

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (!options || !options.skipCSSStub) t.stub(Map.prototype, '_detectMissingCSS');

    const map = new Map(extend({
        container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));

    if (callback) map.on('load', () => {
        callback(null, map);
    });
    if (styleLoadCallback) map.on('style.load', () => {
        styleLoadCallback(null, map);
    });

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}
