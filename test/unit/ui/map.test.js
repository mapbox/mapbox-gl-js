import {test} from '../../util/test.js';
import {extend} from '../../../src/util/util.js';
import window from '../../../src/util/window.js';
import Map from '../../../src/ui/map.js';
import {createMap} from '../../util/index.js';
import LngLat from '../../../src/geo/lng_lat.js';
import LngLatBounds from '../../../src/geo/lng_lat_bounds.js';
import Tile from '../../../src/source/tile.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {Event, ErrorEvent} from '../../../src/util/evented.js';
import simulate from '../../util/simulate_interaction.js';
import {fixedLngLat, fixedNum} from '../../util/fixed.js';
import Fog from '../../../src/style/fog.js';
import Color from '../../../src/style-spec/util/color.js';
import {MAX_MERCATOR_LATITUDE} from '../../../src/geo/mercator_coordinate.js';
import {performanceEvent_} from '../../../src/util/mapbox.js';
import assert from 'assert';

function createStyleSource() {
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    };
}

// Mock implementation of elevation
const createElevation = (func, exaggeration) => {
    return {
        _exaggeration: exaggeration,
        isDataAvailableAtPoint(_) {
            return true;
        },
        getAtPointOrZero(point, def) {
            return this.getAtPoint(point, def) || 0;
        },
        getAtPoint(point, def) {
            return func(point) * this.exaggeration() || def;
        },
        getForTilePoints() {
            return false;
        },
        getMinElevationBelowMSL: () => 0,

        exaggeration() {
            return this._exaggeration;
        }
    };
};

test('Map', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('constructor', (t) => {
        const map = createMap(t, {interactive: true, style: null});
        t.ok(map.getContainer());
        t.equal(map.getStyle(), undefined);
        t.ok(map.boxZoom.isEnabled());
        t.ok(map.doubleClickZoom.isEnabled());
        t.ok(map.dragPan.isEnabled());
        t.ok(map.dragRotate.isEnabled());
        t.ok(map.keyboard.isEnabled());
        t.ok(map.scrollZoom.isEnabled());
        t.ok(map.touchZoomRotate.isEnabled());
        t.notok(map._language);
        t.notok(map._worldview);
        t.throws(() => {
            new Map({
                container: 'anElementIdWhichDoesNotExistInTheDocument',
                testMode: true
            });
        }, new Error("Container 'anElementIdWhichDoesNotExistInTheDocument' not found"), 'throws on invalid map container id');
        t.end();
    });

    t.test('disablePerformanceMetricsCollection', (t) => {
        const map = createMap(t, {performanceMetricsCollection: false});
        map.once('idle', () => {
            map.triggerRepaint();
            map.once('idle', () => {
                t.ok(map._fullyLoaded);
                t.ok(map._loaded);
                t.equals(window.server.requests.length, 0);
                t.end();
            });
        });
    });

    t.test('default performance metrics collection', (t) => {
        const map = createMap(t);
        map._requestManager._customAccessToken = 'access-token';
        map.once('idle', () => {
            map.triggerRepaint();
            map.once('idle', () => {
                t.ok(map._fullyLoaded);
                t.ok(map._loaded);
                const reqBody = window.server.requests[0].requestBody;
                const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
                t.equals(performanceEvent.event, 'gljs.performance');
                performanceEvent_.pendingRequest = null;
                t.end();
            });
        });
    });

    t.test('performance metrics event stores explicit projection', (t) => {
        const map = createMap(t, {projection: 'globe', zoom: 20});
        map._requestManager._customAccessToken = 'access-token';
        map.once('idle', () => {
            map.triggerRepaint();
            map.once('idle', () => {
                t.ok(map._fullyLoaded);
                t.ok(map._loaded);
                const reqBody = window.server.requests[0].requestBody;
                const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
                const checkMetric = (data, metricName, metricValue) => {
                    for (const metric of data) {
                        if (metric.name === metricName) {
                            t.equals(metric.value, metricValue);
                            return;
                        }
                    }
                    assert(false);
                };
                checkMetric(performanceEvent.attributes, 'projection', 'globe');
                performanceEvent_.pendingRequest = null;
                t.end();
            });
        });
    });

    t.test('warns when map container is not empty', (t) => {
        const container = window.document.createElement('div');
        container.textContent = 'Hello World';
        const stub = t.stub(console, 'warn');

        createMap(t, {container, testMode: true});

        t.ok(stub.calledOnce);

        t.end();
    });

    t.test('bad map-specific token breaks map', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        createMap(t, {accessToken:'notAToken'});
        t.error();
        t.end();
    });

    t.test('initial bounds in constructor options', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});

        const bounds = [[-133, 16], [-68, 50]];
        const map = createMap(t, {container, bounds});

        t.deepEqual(fixedLngLat(map.getCenter(), 4), {lng: -100.5, lat: 34.7171});
        t.equal(fixedNum(map.getZoom(), 3), 2.113);

        t.end();
    });

    t.test('initial bounds options in constructor options', (t) => {
        const bounds = [[-133, 16], [-68, 50]];

        const map = (fitBoundsOptions, skipCSSStub) => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'offsetWidth', {value: 512});
            Object.defineProperty(container, 'offsetHeight', {value: 512});
            return createMap(t, {skipCSSStub, container, bounds, fitBoundsOptions});
        };

        const unpadded = map(undefined, false);
        const padded = map({padding: 100}, true);

        t.ok(unpadded.getZoom() > padded.getZoom());

        t.end();
    });

    t.test('disables handlers', (t) => {
        t.test('disables all handlers', (t) => {
            const map = createMap(t, {interactive: false});

            t.notOk(map.boxZoom.isEnabled());
            t.notOk(map.doubleClickZoom.isEnabled());
            t.notOk(map.dragPan.isEnabled());
            t.notOk(map.dragRotate.isEnabled());
            t.notOk(map.keyboard.isEnabled());
            t.notOk(map.scrollZoom.isEnabled());
            t.notOk(map.touchZoomRotate.isEnabled());

            t.end();
        });

        const handlerNames = [
            'scrollZoom',
            'boxZoom',
            'dragRotate',
            'dragPan',
            'keyboard',
            'doubleClickZoom',
            'touchZoomRotate'
        ];
        handlerNames.forEach((handlerName) => {
            t.test(`disables "${handlerName}" handler`, (t) => {
                const options = {};
                options[handlerName] = false;
                const map = createMap(t, options);

                t.notOk(map[handlerName].isEnabled());

                t.end();
            });
        });

        t.end();
    });

    t.test('emits load event after a style is set', (t) => {
        t.stub(Map.prototype, '_detectMissingCSS');
        t.stub(Map.prototype, '_authenticate');
        const map = new Map({container: window.document.createElement('div'), testMode: true});

        map.on('load', fail);

        setTimeout(() => {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

        function fail() { t.ok(false); }
        function pass() { t.end(); }
    });

    t.test('#cameraForBounds', (t) => {
        t.test('crossing globe-mercator threshold globe -> mercator does not affect cameraForBounds result', (t) => {
            const map = createMap(t);
            map.setProjection('globe');
            const bb = [[-133, 16], [-132, 18]];

            let transform;

            map.setZoom(0);
            map._updateProjectionTransition();

            t.equal(map.transform.projection.name, "globe");

            transform = map.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -132.5, lat: 17.0027});
            t.equal(fixedNum(transform.zoom, 3), 6.071);

            map.setZoom(10);
            map._updateProjectionTransition();

            t.equal(map.transform.projection.name, "mercator");

            transform = map.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -132.5, lat: 17.0027});
            t.equal(fixedNum(transform.zoom, 3), 6.071);
            t.end();
        });

        t.test('crossing globe-mercator threshold mercator -> globe does not affect cameraForBounds result', (t) => {
            const map = createMap(t);
            map.setProjection('globe');
            const bb = [[-133, 16], [-68, 50]];

            let transform;

            map.setZoom(10);
            map._updateProjectionTransition();

            t.equal(map.transform.projection.name, "mercator");

            transform = map.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.716});
            t.equal(fixedNum(transform.zoom, 3), 0.75);

            map.setZoom(0);
            map._updateProjectionTransition();

            t.equal(map.transform.projection.name, "globe");

            transform = map.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.716});
            t.equal(fixedNum(transform.zoom, 3), 0.75);
            t.end();
        });

        t.end();
    });

    t.test('#setStyle', (t) => {
        t.test('returns self', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            const map = new Map({container: window.document.createElement('div'), testMode: true});
            t.equal(map.setStyle({
                version: 8,
                sources: {},
                layers: []
            }), map);
            t.end();
        });

        t.test('sets up event forwarding', (t) => {
            createMap(t, {}, (error, map) => {
                t.error(error);

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('error', recordEvent);
                map.on('data', recordEvent);
                map.on('dataloading', recordEvent);

                map.style.fire(new Event('error'));
                map.style.fire(new Event('data'));
                map.style.fire(new Event('dataloading'));

                t.deepEqual(events, [
                    'error',
                    'data',
                    'dataloading',
                ]);

                t.end();
            });
        });

        t.test('fires *data and *dataloading events', (t) => {
            createMap(t, {}, (error, map) => {
                t.error(error);

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('styledata', recordEvent);
                map.on('styledataloading', recordEvent);
                map.on('sourcedata', recordEvent);
                map.on('sourcedataloading', recordEvent);
                map.on('tiledata', recordEvent);
                map.on('tiledataloading', recordEvent);

                map.style.fire(new Event('data', {dataType: 'style'}));
                map.style.fire(new Event('dataloading', {dataType: 'style'}));
                map.style.fire(new Event('data', {dataType: 'source'}));
                map.style.fire(new Event('dataloading', {dataType: 'source'}));
                map.style.fire(new Event('data', {dataType: 'tile'}));
                map.style.fire(new Event('dataloading', {dataType: 'tile'}));

                t.deepEqual(events, [
                    'styledata',
                    'styledataloading',
                    'sourcedata',
                    'sourcedataloading',
                    'tiledata',
                    'tiledataloading'
                ]);

                t.end();
            });
        });

        t.test('can be called more than once', (t) => {
            const map = createMap(t);

            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});

            t.end();
        });

        t.test('style transform overrides unmodified map transform', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            t.stub(Map.prototype, '_authenticate');
            const map = new Map({container: window.document.createElement('div'), testMode: true});

            map.transform.setMaxBounds(LngLatBounds.convert([-120, -60, 140, 80]));
            map.transform.resize(600, 400);
            t.ok(map.transform.zoom, 0.698303973797101, 'map transform is constrained');
            t.ok(map.transform.unmodified, 'map transform is not modified');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({lng: -73.9749, lat: 40.7736}));
                t.equal(fixedNum(map.transform.zoom), 12.5);
                t.equal(fixedNum(map.transform.bearing), 29);
                t.equal(fixedNum(map.transform.pitch), 50);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via options', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            t.stub(Map.prototype, '_authenticate');
            const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888], testMode: true});
            t.notOk(map.transform.unmodified, 'map transform is modified by options');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({lng: -77.0186, lat: 38.8888}));
                t.equal(fixedNum(map.transform.zoom), 10);
                t.equal(fixedNum(map.transform.bearing), 0);
                t.equal(fixedNum(map.transform.pitch), 0);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via setters', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            t.stub(Map.prototype, '_authenticate');
            const map = new Map({container: window.document.createElement('div'), testMode: true});
            t.ok(map.transform.unmodified);
            map.setZoom(10);
            map.setCenter([-77.0186, 38.8888]);
            t.notOk(map.transform.unmodified, 'map transform is modified via setters');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({lng: -77.0186, lat: 38.8888}));
                t.equal(fixedNum(map.transform.zoom), 10);
                t.equal(fixedNum(map.transform.bearing), 0);
                t.equal(fixedNum(map.transform.pitch), 0);
                t.end();
            });
        });

        t.test('passing null removes style', (t) => {
            const map = createMap(t);
            const style = map.style;
            t.ok(style);
            t.spy(style, '_remove');
            map.setStyle(null);
            t.equal(style._remove.callCount, 1);
            t.end();
        });

        t.test('Setting globe projection as part of the style enables draping but does not enable terrain', (t) => {
            const map = createMap(t, {style: createStyle(), projection: 'globe'});
            t.equal(map.getProjection().name, 'globe');
            const initStyleObj = map.style;
            t.spy(initStyleObj, 'setTerrain');
            map.on('style.load', () => {
                t.equal(initStyleObj.setTerrain.callCount, 1);
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);
                t.equal(map.getStyle().terrain, undefined);
                t.end();
            });
        });

        t.test('Setting globe projection at low zoom enables draping but does not enable terrain', (t) => {
            const map = createMap(t, {style: createStyle()});
            t.equal(map.getProjection().name, 'mercator');
            const initStyleObj = map.style;
            t.spy(initStyleObj, 'setTerrain');
            map.on('style.load', () => {
                map.setZoom(3); // Below threshold for Mercator transition
                map.setProjection('globe');
                t.equal(initStyleObj.setTerrain.callCount, 1);
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);
                t.equal(map.getStyle().terrain, undefined);
                map.setZoom(12); // Above threshold for Mercator transition
                map.once('render', () => {
                    t.notOk(map.style.terrain);
                    t.end();
                });
            });
        });

        t.test('Setting globe projection at high zoom does not enable draping', (t) => {
            const map = createMap(t, {style: createStyle()});
            t.equal(map.getProjection().name, 'mercator');
            const initStyleObj = map.style;
            t.spy(initStyleObj, 'setTerrain');
            map.on('style.load', () => {
                map.setZoom(12); // Above threshold for Mercator transition
                map.setProjection('globe');
                t.equal(initStyleObj.setTerrain.callCount, 0);
                t.notOk(map.style.terrain);
                t.equal(map.getTerrain(), null);
                t.equal(map.getStyle().terrain, undefined);
                map.setZoom(3); // Below threshold for Mercator transition
                map.once('render', () => {
                    t.equal(initStyleObj.setTerrain.callCount, 1);
                    t.ok(map.style.terrain);
                    t.equal(map.getTerrain(), null);
                    t.true(map.painter._terrain.isUsingMockSource());
                    t.equal(map.getStyle().terrain, undefined);
                    t.end();
                });
            });
        });

        t.test('Setting globe projection retains style.terrain when terrain is set to null', (t) => {
            const map = createMap(t, {style: createStyle(), projection: 'globe'});
            t.equal(map.getProjection().name, 'globe');
            const initStyleObj = map.style;
            t.spy(initStyleObj, 'setTerrain');
            map.on('style.load', () => {
                map.setTerrain(null);
                t.equal(initStyleObj.setTerrain.callCount, 2);
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);
                t.end();
            });
        });

        t.test('Setting globe and terrain as part of the style retains the terrain properties', (t) => {
            const style = createStyle();
            style['projection'] = {
                'name': 'globe'
            };
            style['sources']['mapbox-dem'] = {
                'type': 'raster-dem',
                'tiles': ['http://example.com/{z}/{x}/{y}.png']
            };
            style['terrain'] = {
                'source': 'mapbox-dem'
            };
            const map = createMap(t, {style});
            map.on('style.load', () => {
                t.equal(map.getProjection().name, 'globe');
                t.ok(map.style.terrain);
                t.deepEqual(map.getTerrain(), style['terrain']);

                t.end();
            });
        });

        t.test('Toggling globe and mercator projections at high zoom levels returns expected `map.getProjection()` result', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.spy(map.painter, 'clearBackgroundTiles');

            map.on('load', () => {
                map.setZoom(7);
                t.equal(map.getProjection().name, 'mercator');

                map.setProjection('globe');
                t.equal(map.getProjection().name, 'globe');

                map.setZoom(4);
                t.equal(map.getProjection().name, 'globe');
                t.equal(map.painter.clearBackgroundTiles.callCount, 0);

                t.end();
            });
        });

        t.test('https://github.com/mapbox/mapbox-gl-js/issues/11352', (t) => {
            const styleSheet = new window.CSSStyleSheet();
            styleSheet.insertRule('.mapboxgl-canary { background-color: rgb(250, 128, 114); }', 0);
            window.document.styleSheets[0] = styleSheet;
            window.document.styleSheets.length = 1;
            const style = createStyle();
            const div = window.document.createElement('div');
            let map = new Map({style, container: div, testMode: true});
            map.setZoom(3);
            map.on('load', () => {
                map.setProjection('globe');
                t.equal(map.getProjection().name, 'globe');
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);
                // Should not overwrite style: https://github.com/mapbox/mapbox-gl-js/issues/11939
                t.equal(style.terrain, undefined);
                map.remove();

                map = new Map({style, container: div, testMode: true});
                t.equal(map.getProjection().name, 'mercator');
                t.equal(map.getTerrain(), null);
                t.equal(style.terrain, undefined);
                t.end();
            });
        });

        t.test('https://github.com/mapbox/mapbox-gl-js/issues/11367', (t) => {
            const style1 = createStyle();
            const map = createMap(t, {style: style1});
            map.setZoom(3);
            map.on('style.load', () => {
                map.setProjection('globe');
                t.equal(map.getProjection().name, 'globe');
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);

                const style2 = createStyle();
                map.setStyle(style2);
                t.equal(map.getProjection().name, 'globe');
                t.ok(map.style.terrain);
                t.equal(map.getTerrain(), null);

                t.end();
            });
        });

        t.test('updating terrain triggers style diffing using setTerrain operation', (t) => {
            t.test('removing terrain', (t) => {
                const style = createStyle();
                style['sources']["mapbox-dem"] = {
                    "type": "raster-dem",
                    "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                    "tileSize": 256,
                    "maxzoom": 14
                };
                style['terrain'] = {
                    "source": "mapbox-dem"
                };
                const map = createMap(t, {style});
                const initStyleObj = map.style;
                t.spy(initStyleObj, 'setTerrain');
                t.spy(initStyleObj, 'setState');
                map.on('style.load', () => {
                    map.setStyle(createStyle());
                    t.equal(initStyleObj, map.style);
                    t.equal(initStyleObj.setState.callCount, 1);
                    t.equal(initStyleObj.setTerrain.callCount, 1);
                    t.ok(map.style.terrain == null);
                    t.end();
                });

            });

            t.test('adding terrain', (t) => {
                const style = createStyle();
                const map = createMap(t, {style});
                const initStyleObj = map.style;
                t.spy(initStyleObj, 'setTerrain');
                t.spy(initStyleObj, 'setState');
                map.on('style.load', () => {
                    const styleWithTerrain = JSON.parse(JSON.stringify(style));

                    styleWithTerrain['sources']["mapbox-dem"] = {
                        "type": "raster-dem",
                        "tiles": ['http://example.com/{z}/{x}/{y}.png'],
                        "tileSize": 256,
                        "maxzoom": 14
                    };
                    styleWithTerrain['terrain'] = {
                        "source": "mapbox-dem"
                    };
                    map.setStyle(styleWithTerrain);
                    t.equal(initStyleObj, map.style);
                    t.equal(initStyleObj.setState.callCount, 1);
                    t.equal(initStyleObj.setTerrain.callCount, 1);
                    t.ok(map.style.terrain);
                    t.end();
                });
            });

            t.end();
        });

        t.test('Setting globe and then terrain correctly sets terrain mock source', (t) => {
            const style = createStyle();
            const map = createMap(t, {style, projection: 'globe'});
            map.setZoom(3);
            map.on('style.load', () => {
                map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.terrain-rgb',
                    'tileSize': 512,
                    'maxzoom': 14
                });
                map.once('render', () => {
                    t.true(map.painter._terrain.isUsingMockSource());
                    map.setTerrain({'source': 'mapbox-dem'});
                    map.once('render', () => {
                        t.false(map.painter._terrain.isUsingMockSource());
                        map.setTerrain(null);
                        map.once('render', () => {
                            t.true(map.painter._terrain.isUsingMockSource());
                            t.end();
                        });
                    });
                });
            });
        });

        t.test('Setting terrain and then globe correctly sets terrain mock source', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            map.setZoom(3);
            map.on('style.load', () => {
                map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.terrain-rgb',
                    'tileSize': 512,
                    'maxzoom': 14
                });
                map.setTerrain({'source': 'mapbox-dem'});
                map.once('render', () => {
                    t.false(map.painter._terrain.isUsingMockSource());
                    map.setProjection('globe');
                    t.false(map.painter._terrain.isUsingMockSource());
                    map.setTerrain(null);
                    map.once('render', () => {
                        t.true(map.painter._terrain.isUsingMockSource());
                        t.end();
                    });
                });
            });
        });

        t.test('should apply different styles when toggling setStyle (https://github.com/mapbox/mapbox-gl-js/issues/11939)', (t) => {
            const styleWithTerrainExaggeration = {
                'version': 8,
                'sources': {
                    'mapbox-dem': {
                        'type': 'raster-dem',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'terrain': {
                    'source': 'mapbox-dem',
                    'exaggeration': 500
                },
                'layers': []
            };

            const styleWithoutTerrainExaggeration = {
                'version': 8,
                'sources': {
                    'mapbox-dem': {
                        'type': 'raster-dem',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'terrain': {
                    'source': 'mapbox-dem'
                },
                'layers': []
            };

            const map = createMap(t, {style: styleWithTerrainExaggeration});

            map.on('style.load', () => {
                t.equal(map.getTerrain().exaggeration, 500);

                map.setStyle(styleWithoutTerrainExaggeration);
                t.equal(map.getTerrain().exaggeration, 1);

                map.setStyle(styleWithTerrainExaggeration);
                t.equal(map.getTerrain().exaggeration, 500);

                t.equal(styleWithoutTerrainExaggeration.terrain.exaggeration, undefined);
                t.equal(styleWithTerrainExaggeration.terrain.exaggeration, 500);
                t.end();
            });
        });

        t.test('should apply different projections when toggling setStyle (https://github.com/mapbox/mapbox-gl-js/issues/11916)', (t) => {
            const styleWithWinkelTripel = {
                'version': 8,
                'sources': {},
                'projection': {'name': 'winkelTripel'},
                'layers': []
            };

            const styleWithGlobe = {
                'version': 8,
                'sources': {},
                'projection': {'name': 'globe'},
                'layers': []
            };

            const map = createMap(t, {style: styleWithWinkelTripel});

            map.on('style.load', () => {
                t.equal(map.getProjection().name, 'winkelTripel');

                map.setStyle(styleWithGlobe);
                t.equal(map.getProjection().name, 'globe');

                map.setStyle(styleWithWinkelTripel);
                t.equal(map.getProjection().name, 'winkelTripel');

                t.equal(styleWithGlobe.projection.name, 'globe');
                t.equal(styleWithWinkelTripel.projection.name, 'winkelTripel');
                t.end();
            });
        });

        t.test('should apply fog default values when toggling different fog styles with setStyle', (t) => {
            const styleA = {
                'version': 8,
                'sources': {},
                'fog': {'color': 'red'},
                'layers': []
            };

            const styleB = {
                'version': 8,
                'sources': {},
                'fog':  {
                    'color': '#0F2127',
                    'high-color': '#000',
                    'horizon-blend': 0.5,
                    'space-color': '#000'
                },
                'layers': []
            };

            const map = createMap(t, {style: styleA});

            map.on('style.load', () => {
                t.equal(map.getFog()['color'], 'red');
                t.equal(map.getFog()['high-color'], '#245cdf');

                map.setStyle(styleB);
                t.equal(map.getFog()['color'], '#0F2127');
                t.equal(map.getFog()['high-color'], '#000');

                map.setStyle(styleA);
                t.equal(map.getFog()['color'], 'red');
                t.equal(map.getFog()['high-color'], '#245cdf');

                t.end();
            });
        });

        t.test('updating fog results in correct transitions', (t) => {
            t.test('sets fog with transition', (t) => {
                const fog = new Fog({
                    'color': 'white',
                    'range': [0, 1],
                    'horizon-blend': 0.0
                });
                fog.set({'color-transition': {duration: 3000}});

                fog.set({'color': 'red'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                t.deepEqual(fog.properties.get('color'), new Color(1, 0.5, 0.5, 1));
                fog.recalculate({zoom: 16, now: 3000});
                t.deepEqual(fog.properties.get('color'), new Color(1, 0.0, 0.0, 1));
                fog.recalculate({zoom: 16, now: 3500});
                t.deepEqual(fog.properties.get('color'), new Color(1, 0.0, 0.0, 1));

                fog.set({'range-transition': {duration: 3000}});
                fog.set({'range': [2, 5]});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                t.deepEqual(fog.properties.get('range')[0], 1.25);
                t.deepEqual(fog.properties.get('range')[1], 7.5);
                fog.recalculate({zoom: 16, now: 3000});
                t.deepEqual(fog.properties.get('range')[0], 2);
                t.deepEqual(fog.properties.get('range')[1], 5);
                fog.recalculate({zoom: 16, now: 3500});
                t.deepEqual(fog.properties.get('range')[0], 2);
                t.deepEqual(fog.properties.get('range')[1], 5);

                fog.set({'horizon-blend-transition': {duration: 3000}});
                fog.set({'horizon-blend': 0.5});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                t.deepEqual(fog.properties.get('horizon-blend'), 0.3);
                fog.recalculate({zoom: 16, now: 3000});
                t.deepEqual(fog.properties.get('horizon-blend'), 0.5);
                fog.recalculate({zoom: 16, now: 3500});
                t.deepEqual(fog.properties.get('horizon-blend'), 0.5);

                fog.set({'star-intensity-transition': {duration: 3000}});
                fog.set({'star-intensity': 0.5});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                t.deepEqual(fog.properties.get('star-intensity'), 0.25);
                fog.recalculate({zoom: 16, now: 3000});
                t.deepEqual(fog.properties.get('star-intensity'), 0.5);
                fog.recalculate({zoom: 16, now: 3500});
                t.deepEqual(fog.properties.get('star-intensity'), 0.5);

                fog.set({'high-color-transition': {duration: 3000}});
                fog.set({'high-color': 'blue'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 3000});
                t.deepEqual(fog.properties.get('high-color'), new Color(0.0, 0.0, 1.0, 1));

                fog.set({'space-color-transition': {duration: 3000}});
                fog.set({'space-color': 'blue'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 5000});
                t.deepEqual(fog.properties.get('space-color'), new Color(0.0, 0.0, 1.0, 1));

                t.end();
            });

            t.test('fog respects validation option', (t) => {
                const fog = new Fog({});
                const fogSpy = t.spy(fog, '_validate');

                fog.set({color: [444]}, {validate: false});
                fog.updateTransitions({transition: false}, {});
                fog.recalculate({zoom: 16, now: 10});

                t.ok(fogSpy.calledOnce);
                t.deepEqual(fog.properties.get('color'), [444]);
                t.end();
            });
            t.end();
        });

        t.test('updating fog triggers style diffing using setFog operation', (t) => {
            t.test('removing fog', (t) => {
                const style = createStyle();
                style['fog'] = {
                    "range": [2, 5],
                    "color": "white"
                };
                const map = createMap(t, {style});
                const initStyleObj = map.style;
                t.spy(initStyleObj, 'setFog');
                t.spy(initStyleObj, 'setState');
                map.on('style.load', () => {
                    map.setStyle(createStyle());
                    t.equal(initStyleObj, map.style);
                    t.equal(initStyleObj.setState.callCount, 1);
                    t.equal(initStyleObj.setFog.callCount, 1);
                    t.ok(map.style.fog == null);
                    t.end();
                });
            });

            t.test('adding fog', (t) => {
                const style = createStyle();
                const map = createMap(t, {style});
                const initStyleObj = map.style;
                t.spy(initStyleObj, 'setFog');
                t.spy(initStyleObj, 'setState');
                map.on('style.load', () => {
                    const styleWithFog = JSON.parse(JSON.stringify(style));

                    styleWithFog['fog'] = {
                        "range": [2, 5],
                        "color": "white"
                    };
                    map.setStyle(styleWithFog);
                    t.equal(initStyleObj, map.style);
                    t.equal(initStyleObj.setState.callCount, 1);
                    t.equal(initStyleObj.setFog.callCount, 1);
                    t.ok(map.style.fog);
                    t.end();
                });
            });

            t.end();
        });

        t.end();
    });

    t.test('#is_Loaded', (t) => {

        t.test('Map#isSourceLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                        t.equal(map.isSourceLoaded('geojson'), true, 'true when loaded');
                        t.end();
                    }
                });
                map.addSource('geojson', createStyleSource());
                t.equal(map.isSourceLoaded('geojson'), false, 'false before loaded');
            });
        });

        t.test('Map#isStyleLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            t.equal(map.isStyleLoaded(), false, 'false before style has loaded');
            map.on('load', () => {
                t.equal(map.isStyleLoaded(), true, 'true when style is loaded');
                t.end();
            });
        });

        t.test('Map#areTilesLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.equal(map.areTilesLoaded(), true, 'returns true if there are no sources on the map');
            map.on('load', () => {
                const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
                map.addSource('geojson', createStyleSource());
                map.style._getSourceCache('geojson')._tiles[fakeTileId.key] = new Tile(fakeTileId);
                t.equal(map.areTilesLoaded(), false, 'returns false if tiles are loading');
                map.style._getSourceCache('geojson')._tiles[fakeTileId.key].state = 'loaded';
                t.equal(map.areTilesLoaded(), true, 'returns true if tiles are loaded');
                t.end();
            });
        });

        t.end();
    });

    t.test('#isSourceLoaded', (t) => {

        t.afterEach(() => {
            Map.prototype._detectMissingCSS.restore();
        });

        function setupIsSourceLoaded(tileState, callback) {
            const map = createMap(t);
            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                const source = map.getSource('geojson');
                const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
                map.style._getSourceCache('geojson')._tiles[fakeTileId.key] = new Tile(fakeTileId);
                map.style._getSourceCache('geojson')._tiles[fakeTileId.key].state = tileState;
                callback(map, source);
            });
        }

        t.test('e.isSourceLoaded should return `false` if source tiles are not loaded', (t) => {
            setupIsSourceLoaded('loading', (map) => {
                map.on('data', (e) => {
                    if (e.sourceDataType === 'metadata') {
                        t.equal(e.isSourceLoaded, false, 'false when source is not loaded');
                        t.end();
                    }
                });
            });
        });

        t.test('e.isSourceLoaded should return `true` if source tiles are loaded', (t) => {
            setupIsSourceLoaded('loaded', (map) => {
                map.on('data', (e) => {
                    if (e.sourceDataType === 'metadata') {
                        t.equal(e.isSourceLoaded, true, 'true when source is loaded');
                        t.end();
                    }
                });
            });
        });

        t.test('e.isSourceLoaded should return `true` if source tiles are loaded after calling `setData`', (t) => {
            setupIsSourceLoaded('loaded', (map, source) => {
                map.on('data', (e) => {
                    if (source._data.features[0].properties.name === 'Null Island' && e.sourceDataType === 'metadata') {
                        t.equal(e.isSourceLoaded, true, 'true when source is loaded');
                        t.end();
                    }
                });
                source.setData({
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'properties': {'name': 'Null Island'}
                    }]
                });
            });
        });

        t.end();
    });

    t.test('#getStyle', (t) => {
        t.test('returns the style', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                t.deepEqual(map.getStyle(), style);
                t.end();
            });
        });

        t.test('returns the style with added sources', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                t.end();
            });
        });

        t.test('returns the style with added terrain', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                const terrain = {source: "terrain-source-id", exaggeration: 2};
                map.addSource('terrain-source-id', {
                    "type": "raster-dem",
                    "tiles": [
                        "local://tiles/{z}-{x}-{y}.terrain.png"
                    ]
                });
                map.setTerrain(terrain);
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    terrain, 'sources': map.getStyle().sources
                }));
                t.end();
            });
        });

        t.test('returns the style with added fog', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                const fog = {
                    "range": [2, 5],
                    "color": "blue"
                };
                map.setFog(fog);
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    fog
                }));
                t.ok(map.getFog());
                t.end();
            });
        });

        t.test('returns the style with removed fog', (t) => {
            const style = createStyle();
            style['fog'] = {
                "range": [2, 5],
                "color": "white"
            };
            const map = createMap(t, {style});

            map.on('load', () => {
                map.setFog(null);
                t.deepEqual(map.getStyle(), createStyle());
                t.equal(map.getFog(), null);
                t.end();
            });
        });

        t.test('fires an error on checking if non-existant source is loaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /There is no source with ID/);
                    t.end();
                });
                map.isSourceLoaded('geojson');
            });
        });

        t.test('returns the style with added layers', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            const layer = {
                id: 'background',
                type: 'background'
            };

            map.on('load', () => {
                map.addLayer(layer);
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    layers: [layer]
                }));
                t.end();
            });
        });

        t.test('a layer can be added even if a map is created without a style', (t) => {
            const map = createMap(t, {deleteStyle: true});
            const layer = {
                id: 'background',
                type: 'background'
            };
            map.addLayer(layer);
            t.end();
        });

        t.test('a source can be added even if a map is created without a style', (t) => {
            const map = createMap(t, {deleteStyle: true});
            const source = createStyleSource();
            map.addSource('fill', source);
            t.end();
        });

        t.test('returns the style with added source and layer', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            const source = createStyleSource();
            const layer = {
                id: 'fill',
                type: 'fill',
                source: 'fill'
            };

            map.on('load', () => {
                map.addSource('fill', source);
                map.addLayer(layer);
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    sources: {fill: source},
                    layers: [layer]
                }));
                t.end();
            });
        });

        t.test('creates a new Style if diff fails', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.stub(map.style, 'setState').callsFake(() => {
                throw new Error('Dummy error');
            });
            t.stub(console, 'warn');

            const previousStyle = map.style;
            map.setStyle(style);
            t.ok(map.style && map.style !== previousStyle);
            t.end();
        });

        t.test('creates a new Style if diff option is false', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.stub(map.style, 'setState').callsFake(() => {
                t.fail();
            });

            const previousStyle = map.style;
            map.setStyle(style, {diff: false});
            t.ok(map.style && map.style !== previousStyle);
            t.end();
        });

        t.end();
    });

    t.test('#moveLayer', (t) => {
        const map = createMap(t, {
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId1',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }, {
                    id: 'layerId2',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }]
            })
        });

        map.once('render', () => {
            map.moveLayer('layerId1', 'layerId2');
            t.equal(map.getLayer('layerId1').id, 'layerId1');
            t.equal(map.getLayer('layerId2').id, 'layerId2');
            t.end();
        });
    });

    t.test('#getLayer', (t) => {
        const layer = {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        };
        const map = createMap(t, {
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [layer]
            })
        });

        map.once('render', () => {
            const mapLayer = map.getLayer('layerId');
            t.equal(mapLayer.id, layer.id);
            t.equal(mapLayer.type, layer.type);
            t.equal(mapLayer.source, layer.source);
            t.end();
        });
    });

    t.test('#resize', (t) => {
        t.test('sets width and height from container clients', (t) => {
            const map = createMap(t),
                container = map.getContainer();

            Object.defineProperty(container, 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            map.resize();

            t.equal(map.transform.width, 250);
            t.equal(map.transform.height, 250);

            t.end();
        });

        t.test('does nothing if container size is the same', (t) => {
            const map = createMap(t);

            t.spy(map.transform, 'resize');
            t.spy(map.painter, 'resize');

            map.resize();

            t.notOk(map.transform.resize.called);
            t.notOk(map.painter.resize.called);

            t.end();
        });

        t.test('does not call stop on resize', (t) => {
            const map = createMap(t);

            Object.defineProperty(map.getContainer(), 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            t.spy(map, 'stop');

            map.resize();

            t.notOk(map.stop.called);

            t.end();
        });

        t.test('fires movestart, move, resize, and moveend events', (t) => {
            const map = createMap(t),
                events = [];

            Object.defineProperty(map.getContainer(), 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            ['movestart', 'move', 'resize', 'moveend'].forEach((event) => {
                map.on(event, (e) => {
                    events.push(e.type);
                });
            });

            map.resize();
            t.deepEqual(events, ['movestart', 'move', 'resize', 'moveend']);

            t.end();
        });

        t.test('listen to window resize event', (t) => {
            window.addEventListener = function(type) {
                if (type === 'resize') {
                    //restore empty function not to mess with other tests
                    window.addEventListener = function() {};

                    t.end();
                }
            };

            createMap(t);
        });

        t.test('do not resize if trackResize is false', (t) => {
            const map = createMap(t, {trackResize: false});

            t.spy(map, 'stop');
            t.spy(map, '_update');
            t.spy(map, 'resize');

            map._onWindowResize();

            t.notOk(map.stop.called);
            t.notOk(map._update.called);
            t.notOk(map.resize.called);

            t.end();
        });

        t.test('do resize if trackResize is true (default)', (t) => {
            const map = createMap(t);

            t.spy(map, '_update');
            t.spy(map, 'resize');

            map._onWindowResize();

            t.ok(map._update.called);
            t.ok(map.resize.called);

            t.end();
        });

        t.end();
    });

    t.test('#getBounds', (t) => {

        t.test('default bounds', (t) => {
            const map = createMap(t, {zoom: 0});
            t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
            t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

            t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
                [ -70.31249999999976, -57.326521225216965 ],
                [ 70.31249999999977, 57.32652122521695 ] ])
            );

            t.end();

        });

        t.test('rotated bounds', (t) => {
            const map = createMap(t, {zoom: 1, bearing: 45});
            t.deepEqual(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]]),
                toFixed(map.getBounds().toArray())
            );

            map.setBearing(135);
            t.deepEqual(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]]),
                toFixed(map.getBounds().toArray())
            );

            t.end();
        });

        t.test('padded bounds', (t) => {
            const map = createMap(t, {zoom: 1, bearing: 45});

            map.setPadding({
                left: 100,
                right: 10,
                top: 10,
                bottom: 10
            });

            t.deepEqual(
                toFixed([[-33.5599507477, -31.7907658998], [33.5599507477, 31.7907658998]]),
                toFixed(map.getBounds().toArray())
            );

            t.end();
        });

        t.test('bounds cut off at poles (#10261)', (t) => {
            const map = createMap(t,
                {zoom: 2, center: [0, 90], pitch: 80});
            const bounds = map.getBounds();
            t.same(bounds.getNorth().toFixed(6), MAX_MERCATOR_LATITUDE);
            t.same(
                toFixed(bounds.toArray()),
                toFixed([[ -23.3484820899, 77.6464759596 ], [ 23.3484820899, 85.0511287798 ]])
            );

            map.setBearing(180);
            map.setCenter({lng: 0, lat: -90});

            const sBounds = map.getBounds();
            t.same(sBounds.getSouth().toFixed(6), -MAX_MERCATOR_LATITUDE);
            t.same(
                toFixed(sBounds.toArray()),
                toFixed([[ -23.3484820899, -85.0511287798 ], [ 23.3484820899, -77.6464759596]])
            );

            t.end();
        });

        t.test('on globe', (t) => {
            const map = createMap(t, {zoom: 0, projection: 'globe'});

            let bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                toFixed([[ -73.8873304141, -73.8873304141, ], [ 73.8873304141, 73.8873304141]])
            );

            map.jumpTo({zoom: 0, center: [0, 90]});
            bounds = map.getBounds();
            t.same(bounds.getNorth(), 90);
            t.same(
                toFixed(bounds.toArray()),
                toFixed([[ -180, 11.1637985859 ], [ 180, 90 ]])
            );

            map.jumpTo({zoom: 0, center: [0, -90]});
            bounds = map.getBounds();
            t.same(bounds.getSouth(), -90);
            t.same(
                toFixed(bounds.toArray()),
                toFixed([[ -180, -90 ], [ 180, -11.1637985859]])
            );

            map.jumpTo({zoom: 2, center: [0, 45], bearing: 0, pitch: 20});
            bounds = map.getBounds();
            t.notSame(bounds.getNorth(), 90);

            map.jumpTo({zoom: 2, center: [0, -45], bearing: 180, pitch: -20});
            bounds = map.getBounds();
            t.notSame(bounds.getSouth(), -90);

            t.end();
        });

        t.test('on Albers', (t) => {
            const map = createMap(t, {projection: 'albers'});

            let bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -65.1780745470, -85.0511290000, ],
                    [ 51.0506680427, 79.9819510537 ]
                ]
            );

            map.jumpTo({zoom: 0, center: [-96, 37.5]});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -180, -45.1620125974 ],
                    [ 21.1488460355, 85.0511290000 ]
                ]
            );

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -108.2217655978, 34.8501901832 ],
                    [ -88.9997447442, 49.1066330318 ]
                ]
            );

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -108.2217655978, 34.8501901832 ],
                    [ -88.9997447442, 49.1066330318 ]
                ]
            );

            map.setPitch(50);
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -106.5868397979, 34.9358140751 ],
                    [ -77.8438130022, 58.8683265070 ]
                ]
            );
            t.end();
        });

        t.test('on Winkel Tripel', (t) => {
            const map = createMap(t, {projection: 'winkelTripel'});

            let bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -89.7369085165, -57.5374138724 ],
                    [ 89.7369085165, 57.5374138724 ]
                ]
            );

            map.jumpTo({zoom: 2, center: [-20, -70]});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -58.0047683883, -82.4864361385 ],
                    [ 7.3269895739, -57.3283436312 ]
                ]
            );

            map.jumpTo({zoom: 2, center: [-70, -20]});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -92.4701297641, -34.6981068954 ],
                    [ -51.1668245330, -5.6697541071 ]
                ]
            );

            map.jumpTo({pitch: 50, bearing: -20});
            bounds = map.getBounds();
            t.same(
                toFixed(bounds.toArray()),
                [
                    [ -111.9596616309, -38.1908385183 ],
                    [ -52.4906377771, 22.9304574207 ]
                ]
            );

            t.end();
        });

        t.end();

        function toFixed(bounds) {
            const n = 10;
            return [
                [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
                [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
            ];
        }

        function normalizeFixed(num, n) {
            // workaround for "-0.0000000000" ≠ "0.0000000000"
            return parseFloat(num.toFixed(n)).toFixed(n);
        }
    });

    t.test('#setMaxBounds', (t) => {
        t.test('constrains map bounds', (t) => {
            const map = createMap(t, {zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]]),
                toFixed(map.getBounds().toArray())
            );
            t.end();
        });

        t.test('when no argument is passed, map bounds constraints are removed', (t) => {
            const map = createMap(t, {zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]]),
                toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray())
            );
            t.end();
        });

        t.test('should not zoom out farther than bounds', (t) => {
            const map = createMap(t);
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.notEqual(map.setZoom(0).getZoom(), 0);
            t.end();
        });

        t.test('throws on invalid bounds', (t) => {
            const map = createMap(t, {zoom:0});
            t.throws(() => {
                map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
            }, Error, 'throws on two decoupled array coordinate arguments');
            t.throws(() => {
                map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
            }, Error, 'throws on individual coordinate arguments');
            t.end();
        });

        function toFixed(bounds) {
            const n = 9;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }

        t.end();
    });

    t.test('#getMaxBounds', (t) => {
        t.test('returns null when no bounds set', (t) => {
            const map = createMap(t, {zoom:0});
            t.equal(map.getMaxBounds(), null);
            t.end();
        });

        t.test('returns bounds', (t) => {
            const map = createMap(t, {zoom:0});
            const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]];
            map.setMaxBounds(bounds);
            t.deepEqual(map.getMaxBounds().toArray(), bounds);
            t.end();
        });

        t.end();
    });

    t.test('#getRenderWorldCopies', (t) => {
        t.test('initially false', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            t.equal(map.getRenderWorldCopies(), false);
            t.end();
        });

        t.test('initially true', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            t.equal(map.getRenderWorldCopies(), true);
            t.end();
        });

        t.end();
    });

    t.test('#setRenderWorldCopies', (t) => {
        t.test('initially false', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            map.setRenderWorldCopies(true);
            t.equal(map.getRenderWorldCopies(), true);
            t.end();
        });

        t.test('initially true', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            map.setRenderWorldCopies(false);
            t.equal(map.getRenderWorldCopies(), false);
            t.end();
        });

        t.test('undefined', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            map.setRenderWorldCopies(undefined);
            t.equal(map.getRenderWorldCopies(), true);
            t.end();
        });

        t.test('null', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            map.setRenderWorldCopies(null);
            t.equal(map.getRenderWorldCopies(), false);
            t.end();
        });

        t.end();
    });

    t.test('#setMinZoom', (t) => {
        const map = createMap(t, {zoom:5});

        const onZoomStart = t.spy();
        const onZoom = t.spy();
        const onZoomEnd = t.spy();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMinZoom(3.5);

        t.ok(onZoomStart.calledOnce);
        t.ok(onZoom.calledOnce);
        t.ok(onZoomEnd.calledOnce);

        map.setZoom(1);

        t.equal(onZoomStart.callCount, 2);
        t.equal(onZoom.callCount, 2);
        t.equal(onZoomEnd.callCount, 2);

        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset minZoom', (t) => {
        const map = createMap(t, {minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        t.equal(map.getZoom(), 1);
        t.end();
    });

    t.test('#getMinZoom', (t) => {
        const map = createMap(t, {zoom: 0});
        t.equal(map.getMinZoom(), -2, 'returns default value');
        map.setMinZoom(10);
        t.equal(map.getMinZoom(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore minZooms over maxZoom', (t) => {
        const map = createMap(t, {zoom:2, maxZoom:5});
        t.throws(() => {
            map.setMinZoom(6);
        });
        map.setZoom(0);
        t.equal(map.getZoom(), 0);
        t.end();
    });

    t.test('#setMaxZoom', (t) => {
        const map = createMap(t, {zoom:0});

        const onZoomStart = t.spy();
        const onZoom = t.spy();
        const onZoomEnd = t.spy();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMaxZoom(3.5);

        t.ok(onZoomStart.calledOnce);
        t.ok(onZoom.calledOnce);
        t.ok(onZoomEnd.calledOnce);

        map.setZoom(4);

        t.equal(onZoomStart.callCount, 2);
        t.equal(onZoom.callCount, 2);
        t.equal(onZoomEnd.callCount, 2);

        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset maxZoom', (t) => {
        const map = createMap(t, {maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        t.equal(map.getZoom(), 6);
        t.end();
    });

    t.test('#getMaxZoom', (t) => {
        const map = createMap(t, {zoom: 0});
        t.equal(map.getMaxZoom(), 22, 'returns default value');
        map.setMaxZoom(10);
        t.equal(map.getMaxZoom(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore maxZooms over minZoom', (t) => {
        const map = createMap(t, {minZoom:5});
        t.throws(() => {
            map.setMaxZoom(4);
        });
        map.setZoom(5);
        t.equal(map.getZoom(), 5);
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init', (t) => {
        t.throws(() => {
            createMap(t, {minZoom:10, maxZoom:5});
        }, new Error(`maxZoom must be greater than or equal to minZoom`));
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', (t) => {
        t.throws(() => {
            createMap(t, {minZoom:1, maxZoom:0});
        }, new Error(`maxZoom must be greater than or equal to minZoom`));
        t.end();
    });

    t.test('#setMinPitch', (t) => {
        const map = createMap(t, {pitch: 20});

        const onPitchStart = t.spy();
        const onPitch = t.spy();
        const onPitchEnd = t.spy();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMinPitch(10);

        t.ok(onPitchStart.calledOnce);
        t.ok(onPitch.calledOnce);
        t.ok(onPitchEnd.calledOnce);

        map.setPitch(0);

        t.equal(onPitchStart.callCount, 2);
        t.equal(onPitch.callCount, 2);
        t.equal(onPitchEnd.callCount, 2);

        t.equal(map.getPitch(), 10);
        t.end();
    });

    t.test('unset minPitch', (t) => {
        const map = createMap(t, {minPitch: 20});
        map.setMinPitch(null);
        map.setPitch(0);
        t.equal(map.getPitch(), 0);
        t.end();
    });

    t.test('#getMinPitch', (t) => {
        const map = createMap(t, {pitch: 0});
        t.equal(map.getMinPitch(), 0, 'returns default value');
        map.setMinPitch(10);
        t.equal(map.getMinPitch(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore minPitchs over maxPitch', (t) => {
        const map = createMap(t, {pitch: 0, maxPitch: 10});
        t.throws(() => {
            map.setMinPitch(20);
        });
        map.setPitch(0);
        t.equal(map.getPitch(), 0);
        t.end();
    });

    t.test('#setMaxPitch', (t) => {
        const map = createMap(t, {pitch: 0});

        const onPitchStart = t.spy();
        const onPitch = t.spy();
        const onPitchEnd = t.spy();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMaxPitch(10);

        t.ok(onPitchStart.calledOnce);
        t.ok(onPitch.calledOnce);
        t.ok(onPitchEnd.calledOnce);

        map.setPitch(20);

        t.equal(onPitchStart.callCount, 2);
        t.equal(onPitch.callCount, 2);
        t.equal(onPitchEnd.callCount, 2);

        t.equal(map.getPitch(), 10);
        t.end();
    });

    t.test('unset maxPitch', (t) => {
        const map = createMap(t, {maxPitch:10});
        map.setMaxPitch(null);
        map.setPitch(20);
        t.equal(map.getPitch(), 20);
        t.end();
    });

    t.test('#getMaxPitch', (t) => {
        const map = createMap(t, {pitch: 0});
        t.equal(map.getMaxPitch(), 85, 'returns default value');
        map.setMaxPitch(10);
        t.equal(map.getMaxPitch(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore maxPitchs over minPitch', (t) => {
        const map = createMap(t, {minPitch:10});
        t.throws(() => {
            map.setMaxPitch(0);
        });
        map.setPitch(10);
        t.equal(map.getPitch(), 10);
        t.end();
    });

    t.test('throw on maxPitch smaller than minPitch at init', (t) => {
        t.throws(() => {
            createMap(t, {minPitch: 10, maxPitch: 5});
        }, new Error(`maxPitch must be greater than or equal to minPitch`));
        t.end();
    });

    t.test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', (t) => {
        t.throws(() => {
            createMap(t, {minPitch: 1, maxPitch: 0});
        }, new Error(`maxPitch must be greater than or equal to minPitch`));
        t.end();
    });

    t.test('throw on maxPitch greater than valid maxPitch at init', (t) => {
        t.throws(() => {
            createMap(t, {maxPitch: 90});
        }, new Error(`maxPitch must be less than or equal to 85`));
        t.end();
    });

    t.test('throw on minPitch less than valid minPitch at init', (t) => {
        t.throws(() => {
            createMap(t, {minPitch: -10});
        }, new Error(`minPitch must be greater than or equal to 0`));
        t.end();
    });

    t.test('#getProjection', (t) => {
        t.test('map defaults to Mercator', (t) => {
            const map = createMap(t);
            t.deepEqual(map.getProjection(), {name: 'mercator', center: [0, 0]});
            t.end();
        });

        t.test('respects projection options object', (t) => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap(t, {projection: options});
            t.deepEqual(map.getProjection(), options);
            t.end();
        });

        t.test('respects projection options string', (t) => {
            const map = createMap(t, {projection: 'albers'});
            t.deepEqual(map.getProjection(), {
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
            t.end();
        });

        t.test('composites user and default projection options', (t) => {
            const options = {
                name: 'albers',
                center: [12, 34]
            };
            const map = createMap(t, {projection: options});
            t.deepEqual(map.getProjection(), {
                name: 'albers',
                center: [12, 34],
                parallels: [29.5, 45.5]
            });
            t.end();
        });

        t.test('does not composite user and default projection options for non-conical projections', (t) => {
            const options = {
                name: 'naturalEarth',
                center: [12, 34]
            };
            const map = createMap(t, {projection: options});
            t.deepEqual(map.getProjection(), {
                name: 'naturalEarth',
                center: [0, 0]
            });
            t.end();
        });

        t.test('returns conic projections when cylindrical functions are used', (t) => {
            let options = {
                name: 'albers',
                center: [12, 34],
                parallels: [40, -40]
            };
            const map = createMap(t, {projection: options});
            t.deepEqual(map.getProjection(), options);
            options = {name: 'lambertConformalConic', center: [20, 25], parallels: [30, -30]};
            map.setProjection(options);
            t.deepEqual(map.getProjection(), options);
            t.notOk(map._showingGlobe());
            t.end();
        });

        t.test('returns Albers projection at high zoom', (t) => {
            const map = createMap(t, {projection: 'albers'});
            map.setZoom(12);
            map.once('render', () => {
                t.deepEqual(map.getProjection(), {
                    name: 'albers',
                    center: [-96, 37.5],
                    parallels: [29.5, 45.5]
                });
                t.deepEqual(map.getProjection(), map.transform.getProjection());
                t.notOk(map._showingGlobe());
                t.end();
            });
        });

        t.test('returns globe projection at low zoom', (t) => {
            const map = createMap(t, {projection: 'globe'});
            map.once('render', () => {
                t.deepEqual(map.getProjection(), {
                    name: 'globe',
                    center: [0, 0],
                });
                t.deepEqual(map.getProjection(), map.transform.getProjection());
                t.ok(map._showingGlobe());
                t.end();
            });

        });

        t.test('returns globe projection at high zoom', (t) => {
            const map = createMap(t, {projection: 'globe'});
            map.setZoom(12);
            map.once('render', () => {
                t.deepEqual(map.getProjection(), {
                    name: 'globe',
                    center: [0, 0],
                });
                t.deepEqual(map.transform.getProjection(), {
                    name: 'mercator',
                    center: [0, 0],
                });
                t.notOk(map._showingGlobe());
                t.end();
            });
        });

        t.test('Crossing globe-to-mercator zoom threshold sets mercator transition and calculates matrices', (t) => {
            const map = createMap(t, {projection: 'globe'});

            map.on('load', () => {

                t.spy(map.transform, 'setMercatorFromTransition');
                t.spy(map.transform, '_calcMatrices');

                t.equal(map.transform.setMercatorFromTransition.callCount, 0);
                t.equal(map.transform.mercatorFromTransition, false);
                t.equal(map.transform._calcMatrices.callCount, 0);

                map.setZoom(7);

                map.once('render', () => {
                    t.equal(map.transform.setMercatorFromTransition.callCount, 1);
                    t.equal(map.transform.mercatorFromTransition, true);
                    t.equal(map.transform._calcMatrices.callCount, 3);
                    t.end();

                });
            });
        });

        t.test('Changing zoom on globe does not clear tiles', (t) => {
            const map = createMap(t, {projection: 'globe'});
            t.spy(map.painter, 'clearBackgroundTiles');
            map.on('load', () => {
                t.equal(map.painter.clearBackgroundTiles.callCount, 0);
                t.deepEqual(map.getProjection().name, 'globe');
                t.deepEqual(map.transform.getProjection().name, `globe`);
                t.ok(map._showingGlobe());

                map.setZoom(12);
                map.once('render', () => {
                    t.equal(map.painter.clearBackgroundTiles.callCount, 0);
                    t.deepEqual(map.getProjection().name, 'globe');
                    t.deepEqual(map.transform.getProjection().name, `mercator`);
                    t.notOk(map._showingGlobe());

                    map.setProjection({name: 'mercator'});
                    t.equal(map.painter.clearBackgroundTiles.callCount, 0);
                    t.deepEqual(map.getProjection().name, 'mercator');
                    t.deepEqual(map.transform.getProjection().name, `mercator`);
                    t.notOk(map._showingGlobe());

                    map.setZoom(3);
                    map.once('render', () => {
                        map.setProjection({name: 'globe'});
                        t.equal(map.painter.clearBackgroundTiles.callCount, 1);
                        t.deepEqual(map.getProjection().name, 'globe');
                        t.deepEqual(map.transform.getProjection().name, `globe`);
                        t.ok(map._showingGlobe());
                        t.end();
                    });
                });
            });
        });

        // Behavior described at https://github.com/mapbox/mapbox-gl-js/pull/11204
        t.test('runtime projection overrides style projection', (t) => {
            const map = createMap(t, {style: {
                "version": 8,
                "projection": {
                    "name": "albers"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;
            t.spy(map.painter, 'clearBackgroundTiles');

            map.on('load', () =>  {
                // Defaults to style projection
                t.equal(style.serialize().projection.name, 'albers');
                t.equal(map.transform.getProjection().name, 'albers');
                t.equal(map.painter.clearBackgroundTiles.callCount, 1);

                // Runtime api overrides style projection
                // Stylesheet projection not changed by runtime apis
                map.setProjection({name: 'winkelTripel'});
                t.equal(style.serialize().projection.name, 'albers');
                t.equal(map.transform.getProjection().name, 'winkelTripel');
                t.equal(map.painter.clearBackgroundTiles.callCount, 2);

                // Runtime api overrides stylesheet projection
                style.setState(Object.assign({}, style.serialize(), {projection: {name: 'naturalEarth'}}));
                t.equal(style.serialize().projection.name, 'naturalEarth');
                t.equal(map.transform.getProjection().name, 'winkelTripel');
                t.equal(map.painter.clearBackgroundTiles.callCount, 2);

                // Unsetting runtime projection reveals stylesheet projection
                map.setProjection(null);
                t.equal(style.serialize().projection.name, 'naturalEarth');
                t.equal(map.transform.getProjection().name, 'naturalEarth');
                t.equal(map.getProjection().name, 'naturalEarth');
                t.equal(map.painter.clearBackgroundTiles.callCount, 3);

                // Unsetting stylesheet projection reveals mercator
                const stylesheet = style.serialize();
                delete stylesheet.projection;
                style.setState(stylesheet);
                t.equal(style.serialize().projection, undefined);
                t.equal(map.transform.getProjection().name, 'mercator');
                t.equal(map.painter.clearBackgroundTiles.callCount, 4);

                t.end();
            });
        });

        t.test('setProjection(null) reveals globe when in style', (t) => {
            const map = createMap(t, {style: {
                "version": 8,
                "projection": {
                    "name": "globe"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;

            t.spy(map.painter, 'clearBackgroundTiles');

            map.on('load', () =>  {
                // Defaults to style projection
                t.equal(style.serialize().projection.name, 'globe');
                t.equal(map.transform.getProjection().name, 'globe');
                t.equal(map.painter.clearBackgroundTiles.callCount, 1);

                // Runtime api overrides stylesheet projection
                map.setProjection('albers');
                t.equal(style.serialize().projection.name, 'globe');
                t.equal(map.transform.getProjection().name, 'albers');
                t.equal(map.painter.clearBackgroundTiles.callCount, 2);

                // Unsetting runtime projection reveals stylesheet projection
                map.setProjection(null);
                t.equal(style.serialize().projection.name, 'globe');
                t.equal(map.transform.getProjection().name, 'globe');
                t.equal(map.getProjection().name, 'globe');
                t.equal(map.painter.clearBackgroundTiles.callCount, 3);

                t.end();
            });
        });

        t.end();
    });

    t.test('#setProjection', (t) => {
        t.test('sets projection by string', (t) => {
            const map = createMap(t);
            map.setProjection('albers');
            t.deepEqual(map.getProjection(), {
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
            t.end();
        });

        t.test('throws error if invalid projection name is supplied', (t) => {
            const map = createMap(t);
            map.on('error', ({error}) => {
                t.match(error.message, /Invalid projection name: fakeProj/);
                t.end();
            });
            t.end();
        });

        t.test('sets projection by options object', (t) => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap(t);
            map.setProjection(options);
            t.deepEqual(map.getProjection(), options);
            t.end();
        });

        t.test('sets projection by options object with just name', (t) => {
            const map = createMap(t);
            map.setProjection({name: 'albers'});
            t.deepEqual(map.getProjection(), {
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
            t.end();
        });

        t.test('setProjection with no argument defaults to Mercator', (t) => {
            const map = createMap(t);
            map.setProjection({name: 'albers'});
            t.equal(map.getProjection().name, 'albers');
            map.setProjection();
            t.deepEqual(map.getProjection(), {name: 'mercator', center: [0, 0]});
            t.end();
        });

        t.test('setProjection(null) defaults to Mercator', (t) => {
            const map = createMap(t);
            map.setProjection({name: 'albers'});
            t.equal(map.getProjection().name, 'albers');
            map.setProjection(null);
            t.deepEqual(map.getProjection(), {name: 'mercator', center: [0, 0]});
            t.end();
        });

        t.test('setProjection persists after new style', (t) => {
            const map = createMap(t);
            map.once('style.load', () => {
                map.setProjection({name: 'albers'});
                t.equal(map.getProjection().name, 'albers');

                // setStyle with diffing
                map.setStyle(Object.assign({}, map.getStyle(), {projection: {name: 'winkelTripel'}}));
                t.equal(map.getProjection().name, 'albers');
                t.equal(map.style.stylesheet.projection.name, 'winkelTripel');

                map.setProjection({name: 'globe'});
                t.equal(map.getProjection().name, 'globe');
                t.equal(map.style.stylesheet.projection.name, 'winkelTripel');
                map.setProjection({name: 'lambertConformalConic'});

                // setStyle without diffing
                const s = map.getStyle();
                delete s.projection;
                map.setStyle(s, {diff: false});
                map.once('style.load', () => {
                    t.equal(map.getProjection().name, 'lambertConformalConic');
                    t.equal(map.style.stylesheet.projection, undefined);
                    t.end();
                });
            });
        });
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap(t);
        t.equal(map.getContainer().childNodes.length, 3);
        map.remove();
        t.equal(map.getContainer().childNodes.length, 0);
        t.end();
    });

    t.test('#remove calls onRemove on added controls', (t) => {
        const map = createMap(t);
        const control = {
            onRemove: t.spy(),
            onAdd (_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        t.ok(control.onRemove.calledOnce);
        t.end();
    });

    t.test('#remove calls onRemove on added controls before style is destroyed', (t) => {
        const map = createMap(t);
        let onRemoveCalled = 0;
        let style;
        const control = {
            onRemove(map) {
                onRemoveCalled++;
                t.deepEqual(map.getStyle(), style);
            },
            onAdd (_) {
                return window.document.createElement('div');
            }
        };

        map.addControl(control);

        map.on('style.load', () => {
            style = map.getStyle();
            map.remove();
            t.equal(onRemoveCalled, 1);
            t.end();
        });
    });

    t.test('#remove deletes gl resources used by the globe', (t) => {
        const style = extend(createStyle(), {zoom: 1});
        const map = createMap(t, {style});
        map.setProjection("globe");

        map.on('style.load', () => {
            map.once('render', () => {
                map.remove();
                const buffers = map.painter.globeSharedBuffers;
                t.ok(buffers);

                const checkBuffer = (name) => buffers[name] && ('buffer' in buffers[name]);

                t.false(checkBuffer('_poleIndexBuffer'));
                t.false(checkBuffer('_gridBuffer'));
                t.false(checkBuffer('_gridIndexBuffer'));
                t.false(checkBuffer('_poleNorthVertexBuffer'));
                t.false(checkBuffer('_poleSouthVertexBuffer'));
                t.false(checkBuffer('_wireframeIndexBuffer'));

                t.end();
            });
        });
    });

    t.test('#remove deletes gl resources used by the atmosphere', (t) => {
        const style = extend(createStyle(), {zoom: 1});
        const map = createMap(t, {style});

        map.on('style.load', () => {
            map.once('render', () => {
                const atmosphereBuffers = map.painter.atmosphereBuffer;

                t.ok(atmosphereBuffers);

                t.true(atmosphereBuffers.vertexBuffer.buffer);
                t.true(atmosphereBuffers.indexBuffer.buffer);

                map.remove();

                t.false(atmosphereBuffers.vertexBuffer.buffer);
                t.false(atmosphereBuffers.indexBuffer.buffer);

                t.end();
            });
        });
    });

    t.test('#remove does not leak event listeners on container', (t) => {
        const container = window.document.createElement('div');
        container.addEventListener = t.spy();
        container.removeEventListener = t.spy();

        t.stub(Map.prototype, '_detectMissingCSS');
        t.stub(Map.prototype, '_authenticate');

        const map = new Map({
            container,
            testMode: true
        });
        map.remove();

        t.equal(container.addEventListener.callCount, container.removeEventListener.callCount);
        t.equal(container.addEventListener.callCount, 1);
        t.equal(container.removeEventListener.callCount, 1);
        t.end();
    });

    t.test('#addControl', (t) => {
        const map = createMap(t);
        const control = {
            onAdd(_) {
                t.equal(map, _, 'addTo() called with map');
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        t.equal(map._controls[1], control, "saves reference to added controls");
        t.end();
    });

    t.test('#removeControl errors on invalid arguments', (t) => {
        const map = createMap(t);
        const control = {};
        const stub = t.stub(console, 'error');

        map.addControl(control);
        map.removeControl(control);
        t.ok(stub.calledTwice);
        t.end();

    });

    t.test('#removeControl', (t) => {
        const map = createMap(t);
        const control = {
            onAdd() {
                return window.document.createElement('div');
            },
            onRemove(_) {
                t.equal(map, _, 'onRemove() called with map');
            }
        };
        map.addControl(control);
        map.removeControl(control);
        t.equal(map._controls.length, 1, "removes removed controls from map's control array");
        t.end();

    });

    t.test('#hasControl', (t) => {
        const map = createMap(t);
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            }
        };

        const control = new Ctrl();
        t.equal(map.hasControl(control), false, 'Reference to control is not found');
        map.addControl(control);
        t.equal(map.hasControl(control), true, 'Reference to control is found');
        t.end();
    });

    function pointToFixed(p, n = 8) {
        return {
            'x': p.x.toFixed(n),
            'y': p.y.toFixed(n)
        };
    }

    t.test('#project', (t) => {
        const map = createMap(t);

        t.test('In Mercator', (t) => {
            t.deepEqual(pointToFixed(map.project({lng: 0, lat: 0})), {x: 100, y: 100});
            t.deepEqual(pointToFixed(map.project({lng: -70.3125, lat: 57.326521225})), {x: 0, y: 0});
            t.end();
        });
        t.test('In Globe', (t) => {
            map.setProjection('globe');
            t.deepEqual(pointToFixed(map.project({lng: 0, lat: 0})), {x: 100, y: 100});
            t.deepEqual(pointToFixed(map.project({lng:  -72.817409474, lat: 43.692434709})), {x: 38.86205343, y: 38.86205343});
            t.end();
        });
        t.test('In Natural Earth', (t) => {
            map.setProjection('naturalEarth');
            t.deepEqual(pointToFixed(map.project({lng: 0, lat: 0})), {x: 100, y: 100});
            t.deepEqual(pointToFixed(map.project({lng: -86.861020716, lat: 61.500721712})), {x: 0, y: 0});
            t.end();
        });
        t.test('In Albers', (t) => {
            map.setProjection('albers');
            t.deepEqual(pointToFixed(map.project({lng: 0, lat: 0})), {x: 100, y: 100});
            t.deepEqual(pointToFixed(map.project({lng: 44.605340721, lat: 79.981951054})), {x: 0, y: 0});
            t.end();
        });
        t.end();
    });

    t.test('#unproject', (t) => {
        const map = createMap(t);
        t.test('In Mercator', (t) => {
            t.deepEqual(fixedLngLat(map.unproject([100, 100])), {lng: 0, lat: 0});
            t.deepEqual(fixedLngLat(map.unproject([0, 0])), {lng: -70.3125, lat: 57.326521225});
            t.end();
        });
        t.test('In Globe', (t) => {
            map.setProjection('globe');
            t.deepEqual(fixedLngLat(map.unproject([100, 100])), {lng: 0, lat: 0});
            t.deepEqual(fixedLngLat(map.unproject([0, 0])), {lng: -67.77848443, lat: 42.791315106});
            t.end();
        });
        t.test('In Natural Earth', (t) => {
            map.setProjection('naturalEarth');
            t.deepEqual(fixedLngLat(map.unproject([100, 100])), {lng: 0, lat: 0});
            t.deepEqual(fixedLngLat(map.unproject([0, 0])), {lng: -86.861020716, lat: 61.500721712});
            t.end();
        });
        t.test('In Albers', (t) => {
            map.setProjection('albers');
            t.deepEqual(fixedLngLat(map.unproject([100, 100])), {lng: 0, lat: 0});
            t.deepEqual(fixedLngLat(map.unproject([0, 0])), {lng: 44.605340721, lat: 79.981951054});
            t.end();
        });
        t.end();
    });

    t.test('#listImages', (t) => {
        const map = createMap(t);

        map.on('load', () => {
            t.equals(map.listImages().length, 0);

            map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

            const images = map.listImages();
            t.equals(images.length, 1);
            t.equals(images[0], 'img');
            t.end();
        });
    });

    t.test('#queryFogOpacity', (t) => {
        t.test('normal range', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            map.on('load', () => {
                map.setFog({
                    "range": [0.5, 10.5]
                });

                t.ok(map.getFog());

                map.once('render', () => {
                    map.setZoom(10);
                    map.setCenter([0, 0]);
                    map.setPitch(0);

                    t.deepEqual(map._queryFogOpacity([0, 0]), 0.0);

                    t.deepEqual(map._queryFogOpacity([50, 0]), 0.0);
                    t.deepEqual(map._queryFogOpacity([0, 50]), 0.0);
                    t.deepEqual(map._queryFogOpacity([-50, 0]), 0.0);
                    t.deepEqual(map._queryFogOpacity([-50, -50]), 0.0);

                    map.setBearing(90);
                    map.setPitch(70);

                    t.deepEqual(map._queryFogOpacity([0, 0]), 0.0);

                    t.deepEqual(map._queryFogOpacity([0.5, 0]), 0.5963390859543484);
                    t.deepEqual(map._queryFogOpacity([0, 0.5]), 0.31817612773293763);
                    t.deepEqual(map._queryFogOpacity([-0.5, 0]), 0.0021931905967484703);
                    t.deepEqual(map._queryFogOpacity([-0.5, -0.5]), 0.4147318524978687);

                    t.deepEqual(map._queryFogOpacity([2, 0]), 1.0);
                    t.deepEqual(map._queryFogOpacity([0, 2]), 1.0);
                    t.deepEqual(map._queryFogOpacity([-2, 0]), 1.0);
                    t.deepEqual(map._queryFogOpacity([-2, -2]), 1.0);

                    map.transform.fov = 30;

                    t.deepEqual(map._queryFogOpacity([0.5, 0]), 0.5917784571074153);
                    t.deepEqual(map._queryFogOpacity([0, 0.5]), 0.2567224170602245);
                    t.deepEqual(map._queryFogOpacity([-0.5, 0]), 0);
                    t.deepEqual(map._queryFogOpacity([-0.5, -0.5]), 0.2727527139608868);

                    t.end();
                });
            });
        });

        t.test('inverted range', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            map.on('load', () => {
                map.setFog({
                    "range": [10.5, 0.5]
                });

                t.ok(map.getFog());

                map.once('render', () => {
                    map.setZoom(10);
                    map.setCenter([0, 0]);
                    map.setBearing(90);
                    map.setPitch(70);

                    t.deepEqual(map._queryFogOpacity([0, 0]), 1.0);

                    t.deepEqual(map._queryFogOpacity([0.5, 0]), 0.961473076058084);
                    t.deepEqual(map._queryFogOpacity([0, 0.5]), 0.9841669559435576);
                    t.deepEqual(map._queryFogOpacity([-0.5, 0]), 0.9988871471476187);
                    t.deepEqual(map._queryFogOpacity([-0.5, -0.5]), 0.9784993261529342);

                    t.end();
                });
            });
        });

        t.test('identical range', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            map.on('load', () => {
                map.setFog({
                    "range": [0, 0]
                });

                t.ok(map.getFog());

                map.once('render', () => {
                    map.setZoom(5);
                    map.setCenter([0, 0]);
                    map.setBearing(90);
                    map.setPitch(70);

                    t.deepEqual(map._queryFogOpacity([0, 0]), 0);

                    t.deepEqual(map._queryFogOpacity([0.5, 0]), 1);
                    t.deepEqual(map._queryFogOpacity([0, 0.5]), 0);
                    t.deepEqual(map._queryFogOpacity([-0.5, 0]), 0);
                    t.deepEqual(map._queryFogOpacity([0, -0.5]), 0);

                    t.end();
                });
            });
        });

        t.end();
    });

    t.test('#listImages throws an error if called before "load"', (t) => {
        const map = createMap(t);
        t.throws(() => {
            map.listImages();
        }, Error);
        t.end();
    });

    t.test('#queryRenderedFeatures', (t) => {

        t.test('if no arguments provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures();

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.ok(args[0]);
                t.deepEqual(args[1], {availableImages: []});
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if only "geometry" provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.deepEqual(args[0], {x: 100, y: 100}); // query geometry
                t.deepEqual(args[1], {availableImages: []}); // params
                t.deepEqual(args[2], map.transform); // transform
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if only "params" provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.ok(args[0]);
                t.deepEqual(args[1], {availableImages: [], filter: ['all']});
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if both "geometry" and "params" provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)), {filter: ['all']});

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.deepEqual(args[0], {x: 100, y: 100});
                t.deepEqual(args[1], {availableImages: [], filter: ['all']});
                t.deepEqual(args[2], map.transform);
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if "geometry" with unwrapped coords provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                t.deepEqual(map.style.queryRenderedFeatures.getCall(0).args[0], {x: 612, y: 100});
                t.end();
            });
        });

        t.test('returns an empty array when no style is loaded', (t) => {
            const map = createMap(t, {style: undefined});
            t.deepEqual(map.queryRenderedFeatures(), []);
            t.end();
        });

        t.end();
    });

    t.test('#language', (t) => {
        t.test('can instantiate map with language', (t) => {
            const map = createMap(t, {language: 'uk'});
            map.on('style.load', () => {
                t.equal(map.getLanguage(), 'uk');
                t.end();
            });
        });

        t.test('can instantiate map with fallback language', (t) => {
            const map = createMap(t, {language: ['en-GB', 'en-US']});
            map.on('style.load', () => {
                t.deepEqual(map.getLanguage(), ['en-GB', 'en-US']);
                t.end();
            });
        });

        t.test('can instantiate map with the preferred language of the user', (t) => {
            const map = createMap(t, {language: 'auto'});
            map.on('style.load', () => {
                t.equal(map.getLanguage(), window.navigator.language);
                t.end();
            });
        });

        t.test('sets and gets language property', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.setLanguage('es');
                t.equal(map.getLanguage(), 'es');
                t.end();
            });
        });

        t.test('can reset language property to default', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.setLanguage('es');
                t.equal(map.getLanguage(), 'es');

                map.setLanguage(['auto', 'en-GB', 'en-US']);
                t.deepEqual(map.getLanguage(), [window.navigator.language, 'en-GB', 'en-US']);

                map.setLanguage([]);
                t.equal(map.getLanguage(), undefined);

                map.setLanguage('auto');
                t.equal(map.getLanguage(), window.navigator.language);

                map.setLanguage();
                t.equal(map.getLanguage(), undefined);

                t.end();
            });
        });

        t.end();
    });

    t.test('#worldview', (t) => {
        t.test('can instantiate map with worldview', (t) => {
            const map = createMap(t, {worldview: 'JP'});
            map.on('style.load', () => {
                t.equal(map.getWorldview(), 'JP');
                t.end();
            });
        });

        t.test('sets and gets worldview property', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.setWorldview('JP');
                t.equal(map.getWorldview(), 'JP');
                t.end();
            });
        });

        t.test('can remove worldview property', (t) => {
            const map = createMap(t);
            map.on('style.load', () => {
                map.setWorldview('JP');
                t.equal(map.getWorldview(), 'JP');
                map.setWorldview();
                t.notOk(map.getWorldview());
                t.end();
            });
        });
        t.end();
    });

    t.test('#setLayoutProperty', (t) => {
        t.test('sets property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": {
                            "type": "geojson",
                            "data": {
                                "type": "FeatureCollection",
                                "features": []
                            }
                        }
                    },
                    "layers": [{
                        "id": "symbol",
                        "type": "symbol",
                        "source": "geojson",
                        "layout": {
                            "text-transform": "uppercase"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.style.dispatcher.broadcast = function(key, value) {
                    t.equal(key, 'updateLayers');
                    t.deepEqual(value.layers.map((layer) => { return layer.id; }), ['symbol']);
                };

                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
                map.style.update({});
                t.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            t.throws(() => {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }, Error, /load/i);

            t.end();
        });

        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /does not exist in the map\'s style and cannot be styled/);
                    t.end();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.test('fires a data event on background layer', (t) => {
            // background layers do not have a source
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.once('style.load', () => {
                map.once('data', (e) => {
                    if (e.dataType === 'style') {
                        t.end();
                    }
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
        });

        t.test('fires a data event on sky layer', (t) => {
            // sky layers do not have a source
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "sky",
                        "type": "sky",
                        "layout": {
                            "visibility": "none"
                        },
                        "paint": {
                            "sky-type": "atmosphere",
                            "sky-atmosphere-sun": [0, 0]
                        }
                    }]
                }
            });

            map.once('style.load', () => {
                map.once('data', (e) => {
                    if (e.dataType === 'style') {
                        t.end();
                    }
                });

                map.setLayoutProperty('sky', 'visibility', 'visible');
            });
        });

        t.test('sets visibility on background layer', (t) => {
            // background layers do not have a source
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('background', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('background', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on raster layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "mapbox://mapbox.satellite": {
                            "type": "raster",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": [{
                        "id": "satellite",
                        "type": "raster",
                        "source": "mapbox://mapbox.satellite",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            // Suppress errors because we're not loading tiles from a real URL.
            map.on('error', () => {});

            map.on('style.load', () => {
                map.setLayoutProperty('satellite', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on video layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "drone": {
                            "type": "video",
                            "urls": [],
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "shore",
                        "type": "raster",
                        "source": "drone",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('shore', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('shore', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on image layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "image": {
                            "type": "image",
                            "url": "",
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "image",
                        "type": "raster",
                        "source": "image",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('image', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('image', 'visibility'), 'visible');
                t.end();
            });
        });

        t.end();
    });

    t.test('#getLayoutProperty', (t) => {
        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /does not exist in the map\'s style/);
                    t.end();
                });
                map.getLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.end();
    });

    t.test('#setPaintProperty', (t) => {
        t.test('sets property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background"
                    }]
                }
            });

            map.on('style.load', () => {
                map.setPaintProperty('background', 'background-color', 'red');
                t.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            t.throws(() => {
                map.setPaintProperty('background', 'background-color', 'red');
            }, Error, /load/i);

            t.end();
        });

        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /does not exist in the map\'s style and cannot be styled/);
                    t.end();
                });
                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });

        t.end();
    });

    t.test('#setFeatureState', (t) => {
        t.test('sets state', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                t.equal(fState.hover, true);
                t.end();
            });
        });
        t.test('works with string ids', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
                t.equal(fState.hover, true);
                t.end();
            });
        });
        t.test('parses feature id as an int', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: '12345'}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                t.equal(fState.hover, true);
                t.end();
            });
        });
        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            t.throws(() => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }, Error, /load/i);

            t.end();
        });
        t.test('fires an error if source not found', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /source/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if sourceLayer not provided for a vector source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /sourceLayer/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if id not provided', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
        t.end();
    });

    t.test('#removeFeatureState', (t) => {

        t.test('accepts "0" id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'click': true});
                map.removeFeatureState({source: 'geojson', id: 0}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 0});
                t.equal(fState.hover, undefined);
                t.equal(fState.click, true);
                t.end();
            });
        });
        t.test('accepts string id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true, 'click': true});
                map.removeFeatureState({source: 'geojson', id: 'foo'}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
                t.equal(fState.hover, undefined);
                t.equal(fState.click, true);
                t.end();
            });
        });
        t.test('remove specific state property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
                map.removeFeatureState({source: 'geojson', id: 12345}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                t.equal(fState.hover, undefined);
                t.end();
            });
        });
        t.test('remove all state properties of one feature', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 1});

                const fState = map.getFeatureState({source: 'geojson', id: 1});
                t.equal(fState.hover, undefined);
                t.equal(fState.foo, undefined);

                t.end();
            });
        });
        t.test('remove properties for zero-based feature IDs.', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 0});

                const fState = map.getFeatureState({source: 'geojson', id: 0});
                t.equal(fState.hover, undefined);
                t.equal(fState.foo, undefined);

                t.end();
            });
        });
        t.test('other properties persist when removing specific property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 1}, 'hover');

                const fState = map.getFeatureState({source: 'geojson', id: 1});
                t.equal(fState.foo, true);

                t.end();
            });
        });
        t.test('remove all state properties of all features in source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

                map.removeFeatureState({source: 'geojson'});

                const fState1 = map.getFeatureState({source: 'geojson', id: 1});
                t.equal(fState1.hover, undefined);
                t.equal(fState1.foo, undefined);

                const fState2 = map.getFeatureState({source: 'geojson', id: 2});
                t.equal(fState2.hover, undefined);
                t.equal(fState2.foo, undefined);

                t.end();
            });
        });
        t.test('specific state deletion should not interfere with broader state deletion', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

                map.removeFeatureState({source: 'geojson', id: 1});
                map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

                const fState1 = map.getFeatureState({source: 'geojson', id: 1});
                t.equal(fState1.hover, undefined);

                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson'});
                map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

                const fState2 = map.getFeatureState({source: 'geojson', id: 2});
                t.equal(fState2.hover, undefined);

                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson'});
                map.removeFeatureState({source: 'geojson', id: 2}, 'foo');

                const fState3 = map.getFeatureState({source: 'geojson', id: 2});
                t.equal(fState3.hover, undefined);

                t.end();
            });
        });
        t.test('add/remove and remove/add state', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

                map.removeFeatureState({source: 'geojson', id: 12345});
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

                const fState1 = map.getFeatureState({source: 'geojson', id: 12345});
                t.equal(fState1.hover, true);

                map.removeFeatureState({source: 'geojson', id: 12345});

                const fState2 = map.getFeatureState({source: 'geojson', id: 12345});
                t.equal(fState2.hover, undefined);

                t.end();
            });
        });
        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            t.throws(() => {
                map.removeFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }, Error, /load/i);

            t.end();
        });
        t.test('fires an error if source not found', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /source/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if sourceLayer not provided for a vector source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /sourceLayer/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if state property is provided without a feature id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
        t.end();
    });

    t.test('error event', (t) => {
        t.test('logs errors to console when it has NO listeners', (t) => {
            const map = createMap(t);
            const stub = t.stub(console, 'error');
            const error = new Error('test');
            map.fire(new ErrorEvent(error));
            t.ok(stub.calledOnce);
            t.equal(stub.getCall(0).args[0], error);
            t.end();
        });

        t.test('calls listeners', (t) => {
            const map = createMap(t);
            const error = new Error('test');
            map.on('error', (event) => {
                t.equal(event.error, error);
                t.end();
            });
            map.fire(new ErrorEvent(error));
        });

        t.end();
    });

    t.test('render stabilizes', (t) => {
        const style = createStyle();
        style.sources.mapbox = {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        };
        style.layers.push({
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        });

        let timer;
        const map = createMap(t, {style});
        map.on('render', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                map.off('render');
                map.on('render', t.fail);
                t.notOk(map._frameId, 'no rerender scheduled');
                t.end();
            }, 100);
        });
    });

    t.test('no render after idle event', (t) => {
        const style = createStyle();
        const map = createMap(t, {style});
        map.on('idle', () => {
            map.on('render', t.fail);
            setTimeout(() => {
                t.end();
            }, 100);
        });
    });

    t.test('no idle event during move', (t) => {
        const style = createStyle();
        const map = createMap(t, {style, fadeDuration: 0});
        map.once('idle', () => {
            map.zoomTo(0.5, {duration: 100});
            t.ok(map.isMoving(), "map starts moving immediately after zoomTo");
            map.once('idle', () => {
                t.ok(!map.isMoving(), "map stops moving before firing idle event");
                t.end();
            });
        });
    });

    t.test('#removeLayer restores Map#loaded() to true', (t) => {
        const map = createMap(t, {
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                layers: [{
                    id: 'layerId',
                    type: 'circle',
                    source: 'mapbox',
                    'source-layer': 'sourceLayer'
                }]
            })
        });

        map.once('render', () => {
            map.removeLayer('layerId');
            map.on('render', () => {
                if (map.loaded()) {
                    map.remove();
                    t.end();
                }
            });
        });
    });

    t.test('stops camera animation on mousedown when interactive', (t) => {
        const map = createMap(t, {interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        t.equal(map.isEasing(), false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on mousedown when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        t.equal(map.isEasing(), true);

        map.remove();
        t.end();
    });

    t.test('stops camera animation on touchstart when interactive', (t) => {
        const map = createMap(t, {interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer(), {touches: [{target: map.getCanvas(), clientX: 0, clientY: 0}]});
        t.equal(map.isEasing(), false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on touchstart when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer());
        t.equal(map.isEasing(), true);

        map.remove();
        t.end();
    });

    t.test('should calculate correct canvas size when transform css property is applied', (t) => {
        const map = createMap(t);
        Object.defineProperty(window, 'getComputedStyle',
            {value: () => ({transform: 'matrix(0.5, 0, 0, 0.5, 0, 0)'})});

        map.resize();

        t.equal(map._containerWidth, 400);
        t.equal(map._containerHeight, 400);

        map.remove();
        t.end();
    });

    t.test('should not warn when CSS is present', (t) => {
        const stub = t.stub(console, 'warn');

        const styleSheet = new window.CSSStyleSheet();
        styleSheet.insertRule('.mapboxgl-canary { background-color: rgb(250, 128, 114); }', 0);
        window.document.styleSheets[0] = styleSheet;
        window.document.styleSheets.length = 1;

        new Map({container: window.document.createElement('div'), testMode: true});

        t.notok(stub.calledOnce);
        t.end();
    });

    t.test('should warn when CSS is missing', (t) => {
        const stub = t.stub(console, 'warn');
        new Map({container: window.document.createElement('div'), testMode: true});

        t.ok(stub.calledOnce);

        t.end();
    });

    t.test('continues camera animation on resize', (t) => {
        const map = createMap(t),
            container = map.getContainer();

        map.flyTo({center: [200, 0], duration: 100});

        Object.defineProperty(container, 'getBoundingClientRect',
            {value: () => ({height: 250, width: 250})});

        map.resize();

        t.ok(map.isMoving(), 'map is still moving after resize due to camera animation');

        t.end();
    });

    t.test('map fires `styleimagemissing` for missing icons', (t) => {
        const map = createMap(t);

        const id = "missing-image";

        let called;
        map.on('styleimagemissing', e => {
            map.addImage(e.id, {width: 1, height: 1, data: new Uint8Array(4)});
            called = e.id;
        });

        t.notok(map.hasImage(id));

        map.style.imageManager.getImages([id], () => {
            t.equals(called, id);
            t.ok(map.hasImage(id));
            t.end();
        });
    });

    t.test('map does not fire `styleimagemissing` for empty icon values', (t) => {
        const map = createMap(t);

        map.on('load', () => {
            map.on('idle', () => {
                t.end();
            });

            map.addSource('foo', {
                type: 'geojson',
                data: {type: 'Point', coordinates: [0, 0]}
            });
            map.addLayer({
                id: 'foo',
                type: 'symbol',
                source: 'foo',
                layout: {
                    'icon-image': ['case', true, '', '']
                }
            });

            map.on('styleimagemissing', ({id}) => {
                t.fail(`styleimagemissing fired for value ${id}`);
            });
        });
    });

    t.test('#snapToNorth', (t) => {

        t.test('snaps when less than < 7 degrees', (t) => {
            const map = createMap(t);
            map.on('load', () =>  {
                map.setBearing(6);
                t.equal(map.getBearing(), 6);
                map.snapToNorth();
                map.once('idle', () => {
                    t.equal(map.getBearing(), 0);
                    t.end();
                });
            });
        });

        t.test('does not snap when > 7 degrees', (t) => {
            const map = createMap(t);
            map.on('load', () =>  {
                map.setBearing(8);
                t.equal(map.getBearing(), 8);
                map.snapToNorth();
                map.once('idle', () => {
                    t.equal(map.getBearing(), 8);
                    t.end();
                });
            });
        });

        t.test('snaps when < bearingSnap', (t) => {
            const map = createMap(t, {"bearingSnap": 12});
            map.on('load', () =>  {
                map.setBearing(11);
                t.equal(map.getBearing(), 11);
                map.snapToNorth();
                map.once('idle', () => {
                    t.equal(map.getBearing(), 0);
                    t.end();
                });
            });
        });

        t.test('does not snap when > bearingSnap', (t) => {
            const map = createMap(t, {"bearingSnap": 10});
            map.on('load', () =>  {
                map.setBearing(11);
                t.equal(map.getBearing(), 11);
                map.snapToNorth();
                map.once('idle', () => {
                    t.equal(map.getBearing(), 11);
                    t.end();
                });
            });
        });
        t.end();
    });

    t.test('map.version', (t) => {
        const map = createMap(t);
        const version = map.version;
        t.test('returns version string', (t) => {
            t.ok(version);
            t.match(version, /^2\.[0-9]+\.[0-9]+(-dev|-beta\.[1-9])?$/);
            t.end();
        });
        t.test('cannot be set', (t) => {
            t.throws(() => {
                map.version = "2.0.0-beta.9";
            }, TypeError, 'Cannot set property version of #<Map> which has only a getter');
            t.notSame(map.version, "2.0.0-beta.9");
            t.same(map.version, version);
            t.end();
        });
        t.end();
    });

    t.test('#queryTerrainElevation', (t) => {
        t.test('no elevation set', (t) => {
            const map = createMap(t);
            let elevation = map.queryTerrainElevation([25, 60]);
            t.notOk(elevation);

            elevation = map.queryTerrainElevation([0, 0]);
            t.notOk(elevation);

            t.end();
        });

        t.test('constant elevation', (t) => {
            const map = createMap(t);
            map.transform.elevation = createElevation(() => 100, 1.0);

            let elevation = map.queryTerrainElevation([25, 60]);
            t.equal(elevation, 100);

            elevation = map.queryTerrainElevation([0, 0]);
            t.equal(elevation, 100);

            t.end();
        });

        t.test('elevation with exaggeration', (t) => {
            const map = createMap(t);
            map.transform.elevation = createElevation((point) => point.x + point.y, 0.1);

            let elevation = map.queryTerrainElevation([0, 0]);
            t.equal(fixedNum(elevation, 7), 0.1);

            elevation = map.queryTerrainElevation([180, 0]);
            t.equal(fixedNum(elevation, 7), 0.15);

            elevation = map.queryTerrainElevation([-180, 85.051129]);
            t.equal(fixedNum(elevation, 7), 0.0);

            elevation = map.queryTerrainElevation([180, -85.051129]);
            t.equal(fixedNum(elevation, 6), 0.2);

            t.end();
        });

        t.end();
    });

    t.end();
});

function createStyle() {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: []
    };
}
