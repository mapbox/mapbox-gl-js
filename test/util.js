import window from '../src/util/window';
import Map from '../src/ui/map';
import { extend} from '../src/util/util';

export function createMap(t, options, callback) {
    const container = window.document.createElement('div');

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (!options || !options.skipCSSStub) t.stub(Map.prototype, '_detectMissingCSS');

    const map = new Map(extend({
        container: container,
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

    return map;
}
