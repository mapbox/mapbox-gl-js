import {describe, test, beforeEach, afterEach, expect, waitFor, vi, createMap} from "../../util/vitest.js";
import {getPNGResponse, getRequestBody} from '../../util/network.js';
import assert from 'assert';
import {extend} from '../../../src/util/util.js';
import Map from '../../../src/ui/map.js';
import RasterTileSource from '../../../src/source/raster_tile_source.js';
import Actor from '../../../src/util/actor.js';
import LngLat from '../../../src/geo/lng_lat.js';
import LngLatBounds from '../../../src/geo/lng_lat_bounds.js';
import Tile from '../../../src/source/tile.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {Event, ErrorEvent} from '../../../src/util/evented.js';
import simulate, {constructTouch} from '../../util/simulate_interaction.js';
import {fixedLngLat, fixedNum} from '../../util/fixed.js';
import Fog from '../../../src/style/fog.js';
import Color from '../../../src/style-spec/util/color.js';
import {MAX_MERCATOR_LATITUDE} from '../../../src/geo/mercator_coordinate.js';
import {performanceEvent_} from '../../../src/util/mapbox.js';
import {makeFQID} from '../../../src/util/fqid.js';
import styleSpec from '../../../src/style-spec/reference/latest.js';

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

describe('Map', () => {
    test('constructor', () => {
        const map = createMap({interactive: true, style: null});
        expect(map.getContainer()).toBeTruthy();
        expect(map.getStyle()).toEqual(undefined);
        expect(map.boxZoom.isEnabled()).toBeTruthy();
        expect(map.doubleClickZoom.isEnabled()).toBeTruthy();
        expect(map.dragPan.isEnabled()).toBeTruthy();
        expect(map.dragRotate.isEnabled()).toBeTruthy();
        expect(map.keyboard.isEnabled()).toBeTruthy();
        expect(map.scrollZoom.isEnabled()).toBeTruthy();
        expect(map.touchZoomRotate.isEnabled()).toBeTruthy();
        expect(map._language).toBeFalsy();
        expect(map._worldview).toBeFalsy();
        expect(() => {
            new Map({
                container: 'anElementIdWhichDoesNotExistInTheDocument',
                testMode: true
            });
        }).toThrowError("Container 'anElementIdWhichDoesNotExistInTheDocument' not found");
    });

    test('default style', () => {
        vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});

        const stub = vi.spyOn(Map.prototype, 'setStyle').mockImplementation(() => {});
        new Map({container: window.document.createElement('div'), testMode: false});

        expect(stub).toHaveBeenCalledTimes(1);
        expect(stub.mock.calls[0][0]).toEqual('mapbox://styles/mapbox/standard');
    });

    test('disablePerformanceMetricsCollection', async () => {
        const fetchSpy = vi.spyOn(window, 'fetch');
        const map = createMap({performanceMetricsCollection: false});
        await waitFor(map, "idle");
        map.triggerRepaint();
        await waitFor(map, "idle");
        expect(map._fullyLoaded).toBeTruthy();
        expect(map._loaded).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('default performance metrics collection', async () => {
        const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{}');
        });
        const map = createMap({performanceMetricsCollection: true});
        map._requestManager._customAccessToken = 'access-token';
        await waitFor(map, "idle");
        map.triggerRepaint();
        await waitFor(map, "idle");
        expect(map._fullyLoaded).toBeTruthy();
        expect(map._loaded).toBeTruthy();
        const reqBody = await getRequestBody(fetchSpy.mock.calls[0][0]);
        const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
        expect(performanceEvent.event).toEqual('gljs.performance');
        performanceEvent_.pendingRequest = null;
    });

    test('performance metrics event stores explicit projection', async () => {
        const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{}');
        });
        const map = createMap({performanceMetricsCollection: true, projection: 'globe', zoom: 20});
        map._requestManager._customAccessToken = 'access-token';
        await waitFor(map, "idle");
        map.triggerRepaint();
        await waitFor(map, "idle");
        expect(map._fullyLoaded).toBeTruthy();
        expect(map._loaded).toBeTruthy();
        const reqBody = await getRequestBody(fetchSpy.mock.calls[0][0]);
        const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
        const checkMetric = (data, metricName, metricValue) => {
            for (const metric of data) {
                if (metric.name === metricName) {
                    expect(metric.value).toEqual(metricValue);
                    return;
                }
            }
            assert(false);
        };
        checkMetric(performanceEvent.attributes, 'projection', 'globe');
        performanceEvent_.pendingRequest = null;
    });

    test('warns when map container is not empty', () => {
        const container = window.document.createElement('div');
        container.textContent = 'Hello World';
        const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});

        createMap({container, testMode: true});

        expect(stub).toHaveBeenCalledTimes(1);
    });

    describe('uses zero values for zoom and coordinates', () => {
        function getInitialMap() {
            return createMap({
                zoom: 0,
                center: [0, 0],
                style: {
                    version: 8,
                    sources: {},
                    layers: [],
                    center: [
                        -73.9749,
                        40.7736
                    ],
                    zoom: 4
                }
            });
        }

        test('should use these values instead of defaults from style', async () => {
            const map = getInitialMap();

            await waitFor(map, "load");
            expect(map.getZoom()).toEqual(0);
            expect(map.getCenter()).toEqual({lat: 0, lng: 0});
        });

        test('after setStyle should still use these values', async () => {
            const map = getInitialMap();

            await waitFor(map, "load");
            map.setStyle({
                version: 8,
                sources: {},
                layers: [],
                center: [
                    24.9384,
                    60.169
                ],
                zoom: 3
            });
            expect(map.getZoom()).toEqual(0);
            expect(map.getCenter()).toEqual({lat: 0, lng: 0});
        });
    });

    test('bad map-specific token breaks map', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        createMap({accessToken:'notAToken'});
    });

    test('initial bounds in constructor options', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});

        const bounds = [[-133, 16], [-68, 50]];
        const map = createMap({container, bounds});

        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(map.getZoom(), 3)).toEqual(2.113);
    });

    test('initial bounds options in constructor options', () => {
        const bounds = [[-133, 16], [-68, 50]];

        const map = (fitBoundsOptions, skipCSSStub) => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'offsetWidth', {value: 512});
            Object.defineProperty(container, 'offsetHeight', {value: 512});
            return createMap({skipCSSStub, container, bounds, fitBoundsOptions});
        };

        const unpadded = map(undefined, false);
        const padded = map({padding: 100}, true);

        expect(unpadded.getZoom() > padded.getZoom()).toBeTruthy();
    });

    describe('disables handlers', () => {
        test('disables all handlers', () => {
            const map = createMap({interactive: false});

            expect(map.boxZoom.isEnabled()).toBeFalsy();
            expect(map.doubleClickZoom.isEnabled()).toBeFalsy();
            expect(map.dragPan.isEnabled()).toBeFalsy();
            expect(map.dragRotate.isEnabled()).toBeFalsy();
            expect(map.keyboard.isEnabled()).toBeFalsy();
            expect(map.scrollZoom.isEnabled()).toBeFalsy();
            expect(map.touchZoomRotate.isEnabled()).toBeFalsy();
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
            test(`disables "${handlerName}" handler`, () => {
                const options = {};
                options[handlerName] = false;
                const map = createMap(options);

                expect(map[handlerName].isEnabled()).toBeFalsy();
            });
        });
    });

    test('emits load event after a style is set', async () => {
        vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
        vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});
        const map = new Map({container: window.document.createElement('div'), testMode: true});

        map.on('load', fail);

        setTimeout(() => {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

        function fail() { expect(false).toBeTruthy(); }
        function pass() {}
    });

    describe('#cameraForBounds', () => {
        test('crossing globe-mercator threshold globe -> mercator does not affect cameraForBounds result', () => {
            const map = createMap();
            map.setProjection('globe');
            const bb = [[-133, 16], [-132, 18]];

            let transform;

            map.setZoom(0);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("globe");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -132.5, lat: 17.0027});
            expect(fixedNum(transform.zoom, 3)).toEqual(6.071);

            map.setZoom(10);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("mercator");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -132.5, lat: 17.0027});
            expect(fixedNum(transform.zoom, 3)).toEqual(6.071);
        });

        test('crossing globe-mercator threshold mercator -> globe does not affect cameraForBounds result', () => {
            const map = createMap();
            map.setProjection('globe');
            const bb = [[-133, 16], [-68, 50]];

            let transform;

            map.setZoom(10);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("mercator");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(0.75);

            map.setZoom(0);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("globe");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(0.75);
        });
    });

    describe('#setStyle', () => {
        test('returns self', () => {
            vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
            const map = new Map({container: window.document.createElement('div'), testMode: true});
            expect(map.setStyle({
                version: 8,
                sources: {},
                layers: []
            })).toEqual(map);
        });

        test('sets up event forwarding', async () => {
            await new Promise(resolve => {
                createMap({}, (error, map) => {
                    expect(error).toBeFalsy();

                    const events = [];
                    function recordEvent(event) { events.push(event.type); }

                    map.on('error', recordEvent);
                    map.on('data', recordEvent);
                    map.on('dataloading', recordEvent);

                    map.style.fire(new Event('error'));
                    map.style.fire(new Event('data'));
                    map.style.fire(new Event('dataloading'));

                    expect(events).toEqual([
                        'error',
                        'data',
                        'dataloading',
                    ]);
                    resolve();
                });

            });
        });

        test('fires *data and *dataloading events', async () => {
            await new Promise(resolve => {
                createMap({}, (error, map) => {
                    expect(error).toBeFalsy();

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

                    expect(events).toEqual([
                        'styledata',
                        'styledataloading',
                        'sourcedata',
                        'sourcedataloading',
                        'tiledata',
                        'tiledataloading'
                    ]);
                    resolve();
                });
            });
        });

        test('can be called more than once', () => {
            const map = createMap();

            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
        });

        test('style transform overrides unmodified map transform', async () => {
            vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
            vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});
            const map = new Map({container: window.document.createElement('div'), testMode: true});

            map.transform.setMaxBounds(LngLatBounds.convert([-120, -60, 140, 80]));
            map.transform.resize(600, 400);
            expect(map.transform.zoom).toBeTruthy();
            expect(map.transform.unmodified).toBeTruthy();
            map.setStyle(createStyle());
            await waitFor(map, "style.load");
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -73.9749, lat: 40.7736}));
            expect(fixedNum(map.transform.zoom)).toEqual(12.5);
            expect(fixedNum(map.transform.bearing)).toEqual(29);
            expect(fixedNum(map.transform.pitch)).toEqual(50);
        });

        test('style transform does not override map transform modified via options', async () => {
            vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
            vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});
            const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888], testMode: true});
            expect(map.transform.unmodified).toBeFalsy();
            map.setStyle(createStyle());
            await waitFor(map, "style.load");
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
            expect(fixedNum(map.transform.zoom)).toEqual(10);
            expect(fixedNum(map.transform.bearing)).toEqual(0);
            expect(fixedNum(map.transform.pitch)).toEqual(0);
        });

        test('style transform does not override map transform modified via setters', async () => {
            vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
            vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});
            const map = new Map({container: window.document.createElement('div'), testMode: true});
            expect(map.transform.unmodified).toBeTruthy();
            map.setZoom(10);
            map.setCenter([-77.0186, 38.8888]);
            expect(map.transform.unmodified).toBeFalsy();
            map.setStyle(createStyle());
            await waitFor(map, "style.load");
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
            expect(fixedNum(map.transform.zoom)).toEqual(10);
            expect(fixedNum(map.transform.bearing)).toEqual(0);
            expect(fixedNum(map.transform.pitch)).toEqual(0);
        });

        test('passing null removes style', () => {
            const map = createMap();
            const style = map.style;
            expect(style).toBeTruthy();
            vi.spyOn(style, '_remove');
            map.setStyle(null);
            expect(style._remove).toHaveBeenCalledTimes(1);
        });

        test('Setting globe projection as part of the style enables draping but does not enable terrain', async () => {
            const map = createMap({style: createStyle(), projection: 'globe'});
            expect(map.getProjection().name).toEqual('globe');
            const initStyleObj = map.style;
            vi.spyOn(initStyleObj, 'setTerrain');
            await waitFor(map, "style.load");
            expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(1);
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
            expect(map.getStyle().terrain).toEqual(undefined);
        });

        test('Setting globe projection at low zoom enables draping but does not enable terrain', async () => {
            const map = createMap({style: createStyle()});
            expect(map.getProjection().name).toEqual('mercator');
            const initStyleObj = map.style;
            vi.spyOn(initStyleObj, 'setTerrain');
            await waitFor(map, "style.load");
            map.setZoom(3); // Below threshold for Mercator transition
            map.setProjection('globe');
            expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(1);
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
            expect(map.getStyle().terrain).toEqual(undefined);
            map.setZoom(12); // Above threshold for Mercator transition
            await waitFor(map, "render");
            expect(map.style.terrain).toBeFalsy();
        });

        test('Setting globe projection at high zoom does not enable draping', async () => {
            const map = createMap({style: createStyle()});
            expect(map.getProjection().name).toEqual('mercator');
            const initStyleObj = map.style;
            vi.spyOn(initStyleObj, 'setTerrain');
            await waitFor(map, "style.load");
            map.setZoom(12); // Above threshold for Mercator transition
            map.setProjection('globe');
            expect(initStyleObj.setTerrain).not.toHaveBeenCalled();
            expect(map.style.terrain).toBeFalsy();
            expect(map.getTerrain()).toEqual(null);
            expect(map.getStyle().terrain).toEqual(undefined);
            map.setZoom(3); // Below threshold for Mercator transition
            await waitFor(map, "render");
            expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(1);
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
            expect(map.painter._terrain.isUsingMockSource()).toBeTruthy();
            expect(map.getStyle().terrain).toEqual(undefined);
        });

        test('Setting globe projection retains style.terrain when terrain is set to null', async () => {
            const map = createMap({style: createStyle(), projection: 'globe'});
            expect(map.getProjection().name).toEqual('globe');
            const initStyleObj = map.style;
            vi.spyOn(initStyleObj, 'setTerrain');
            await waitFor(map, "style.load");
            map.setTerrain(null);
            expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(2);
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
        });

        test('Setting globe and terrain as part of the style retains the terrain properties', async () => {
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
            vi.spyOn(window, 'fetch').mockImplementation(async () => {
                const res = await getPNGResponse();
                return new window.Response(res);
            });
            const map = createMap({style});
            await waitFor(map, 'load');
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(style['terrain']);
        });

        test('Toggling globe and mercator projections at high zoom levels returns expected `map.getProjection()` result', async () => {
            const style = createStyle();
            const map = createMap({style});
            vi.spyOn(map.painter, 'clearBackgroundTiles');

            await waitFor(map, "load");
            map.setZoom(7);
            expect(map.getProjection().name).toEqual('mercator');

            map.setProjection('globe');
            expect(map.getProjection().name).toEqual('globe');

            map.setZoom(4);
            expect(map.getProjection().name).toEqual('globe');
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
        });

        test('Setting terrain to null disables the terrain but does not affect draping', async () => {
            const style = extend(createStyle(), {
                terrain: null,
                imports: [{
                    id: 'basemap',
                    url: '',
                    data: extend(createStyle(), {
                        projection: {name: 'globe'},
                        terrain: {source: 'dem', exaggeration: 1},
                        sources: {dem: {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}}
                    })
                },
                {
                    id: 'navigation',
                    url: '',
                    data: extend(createStyle(), {
                        terrain: {source: 'dem', exaggeration: 2},
                        sources: {dem: {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}}
                    })
                }]
            });

            const map = createMap({style});

            await waitFor(map, "style.load");
            map.setZoom(3);
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toBe(null);
            expect(map.getStyle().terrain).toBe(null);
            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.style.terrain).toBeFalsy();
            expect(map.getTerrain()).toBe(null);
            expect(map.getStyle().terrain).toBe(null);
        });

        test('https://github.com/mapbox/mapbox-gl-js/issues/11352', async () => {
            const style = createStyle();
            const div = window.document.createElement('div');
            let map = createMap({style, container: div, testMode: true});
            map.setZoom(3);
            await waitFor(map, "load");
            map.setProjection('globe');
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
            // Should not overwrite style: https://github.com/mapbox/mapbox-gl-js/issues/11939
            expect(style.terrain).toEqual(undefined);
            map.remove();

            map = createMap({style, container: div, testMode: true});
            expect(map.getProjection().name).toEqual('mercator');
            expect(map.getTerrain()).toEqual(null);
            expect(style.terrain).toEqual(undefined);
        });

        test('https://github.com/mapbox/mapbox-gl-js/issues/11367', async () => {
            const style1 = createStyle();
            const map = createMap({style: style1});
            map.setZoom(3);
            await waitFor(map, "style.load");
            map.setProjection('globe');
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);

            const style2 = createStyle();
            map.setStyle(style2);
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.terrain).toBeTruthy();
            expect(map.getTerrain()).toEqual(null);
        });

        describe(
            'updating terrain triggers style diffing using setTerrain operation',
            () => {
                test('removing terrain', async () => {
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
                    const map = createMap({style});
                    const initStyleObj = map.style;
                    vi.spyOn(initStyleObj, 'setTerrain');
                    vi.spyOn(initStyleObj, 'setState');
                    await waitFor(map, "style.load");
                    map.setStyle(createStyle());
                    expect(initStyleObj).toEqual(map.style);
                    expect(initStyleObj.setState).toHaveBeenCalledTimes(1);
                    expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(1);
                    expect(map.style.terrain == null).toBeTruthy();
                });

                test('adding terrain', async () => {
                    const style = createStyle();
                    vi.spyOn(window, 'fetch').mockImplementation(async () => {
                        const res = await getPNGResponse();
                        return new window.Response(res);
                    });
                    const map = createMap({style});
                    const initStyleObj = map.style;
                    vi.spyOn(initStyleObj, 'setTerrain');
                    vi.spyOn(initStyleObj, 'setState');
                    await waitFor(map, "style.load");
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
                    await waitFor(map, "load");
                    expect(initStyleObj).toEqual(map.style);
                    expect(initStyleObj.setState).toHaveBeenCalledTimes(1);
                    expect(initStyleObj.setTerrain).toHaveBeenCalledTimes(1);
                    expect(map.style.terrain).toBeTruthy();
                });
            });

        test('Setting globe and then terrain correctly sets terrain mock source', async () => {
            const style = createStyle();
            vi.spyOn(RasterTileSource.prototype, 'onAdd').mockImplementation(() => {});
            const map = createMap({style, projection: 'globe'});
            map.setZoom(3);
            await waitFor(map, "style.load");
            map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.terrain-rgb',
                'tileSize': 512,
                'maxzoom': 14
            });
            await waitFor(map, "render");
            expect(map.painter._terrain.isUsingMockSource()).toBeTruthy();
            map.setTerrain({'source': 'mapbox-dem'});
            await waitFor(map, "render");
            expect(map.painter._terrain.isUsingMockSource()).toBeFalsy();
            map.setTerrain(null);
            await waitFor(map, "render");
            expect(map.painter._terrain.isUsingMockSource()).toBeTruthy();
        });

        test('Setting terrain and then globe correctly sets terrain mock source', async () => {
            const style = createStyle();
            vi.spyOn(RasterTileSource.prototype, 'onAdd').mockImplementation(() => {});
            const map = createMap({style});
            map.setZoom(3);
            await waitFor(map, "style.load");
            map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.terrain-rgb',
                'tileSize': 512,
                'maxzoom': 14
            });
            map.setTerrain({'source': 'mapbox-dem'});
            await waitFor(map, "render");
            expect(map.painter._terrain.isUsingMockSource()).toBeFalsy();
            map.setProjection('globe');
            expect(map.painter._terrain.isUsingMockSource()).toBeFalsy();
            map.setTerrain(null);
            await waitFor(map, "render");
            expect(map.painter._terrain.isUsingMockSource()).toBeTruthy();
        });

        test('should apply different styles when toggling setStyle (https://github.com/mapbox/mapbox-gl-js/issues/11939)', async () => {
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

            vi.spyOn(window, 'fetch').mockImplementation(async () => {
                const res = await getPNGResponse();
                return new window.Response(res);
            });
            const map = createMap({style: styleWithTerrainExaggeration});

            await waitFor(map, "load");
            expect(map.getTerrain().exaggeration).toEqual(500);

            map.setStyle(styleWithoutTerrainExaggeration);
            expect(map.getTerrain().exaggeration).toEqual(1);

            map.setStyle(styleWithTerrainExaggeration);
            expect(map.getTerrain().exaggeration).toEqual(500);

            expect(styleWithoutTerrainExaggeration.terrain.exaggeration).toEqual(undefined);
            expect(styleWithTerrainExaggeration.terrain.exaggeration).toEqual(500);
        });

        test('should apply different projections when toggling setStyle (https://github.com/mapbox/mapbox-gl-js/issues/11916)', async () => {
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

            const map = createMap({style: styleWithWinkelTripel});

            await waitFor(map, "style.load");
            expect(map.getProjection().name).toEqual('winkelTripel');

            map.setStyle(styleWithGlobe);
            expect(map.getProjection().name).toEqual('globe');

            map.setStyle(styleWithWinkelTripel);
            expect(map.getProjection().name).toEqual('winkelTripel');

            expect(styleWithGlobe.projection.name).toEqual('globe');
            expect(styleWithWinkelTripel.projection.name).toEqual('winkelTripel');
        });

        test('should apply fog default values when toggling different fog styles with setStyle', async () => {
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

            const map = createMap({style: styleA});

            await waitFor(map, "style.load");
            expect(map.getFog()['color']).toEqual('red');
            expect(map.getFog()['high-color']).toEqual('#245cdf');

            map.setStyle(styleB);
            expect(map.getFog()['color']).toEqual('#0F2127');
            expect(map.getFog()['high-color']).toEqual('#000');

            map.setStyle(styleA);
            expect(map.getFog()['color']).toEqual('red');
            expect(map.getFog()['high-color']).toEqual('#245cdf');
        });

        describe('updating fog results in correct transitions', () => {
            test('sets fog with transition', () => {
                const fog = new Fog({
                    'color': 'white',
                    'range': [0, 1],
                    'horizon-blend': 0.0
                });
                fog.set({'color-transition': {duration: 3000}});

                fog.set({'color': 'red'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                expect(fog.properties.get('color')).toEqual(new Color(1, 0.5, 0.5, 1));
                fog.recalculate({zoom: 16, now: 3000});
                expect(fog.properties.get('color')).toEqual(new Color(1, 0.0, 0.0, 1));
                fog.recalculate({zoom: 16, now: 3500});
                expect(fog.properties.get('color')).toEqual(new Color(1, 0.0, 0.0, 1));

                fog.set({'range-transition': {duration: 3000}});
                fog.set({'range': [2, 5]});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                expect(fog.properties.get('range')[0]).toEqual(1.25);
                expect(fog.properties.get('range')[1]).toEqual(7.5);
                fog.recalculate({zoom: 16, now: 3000});
                expect(fog.properties.get('range')[0]).toEqual(2);
                expect(fog.properties.get('range')[1]).toEqual(5);
                fog.recalculate({zoom: 16, now: 3500});
                expect(fog.properties.get('range')[0]).toEqual(2);
                expect(fog.properties.get('range')[1]).toEqual(5);

                fog.set({'horizon-blend-transition': {duration: 3000}});
                fog.set({'horizon-blend': 0.5});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                expect(fog.properties.get('horizon-blend')).toEqual(0.3);
                fog.recalculate({zoom: 16, now: 3000});
                expect(fog.properties.get('horizon-blend')).toEqual(0.5);
                fog.recalculate({zoom: 16, now: 3500});
                expect(fog.properties.get('horizon-blend')).toEqual(0.5);

                fog.set({'star-intensity-transition': {duration: 3000}});
                fog.set({'star-intensity': 0.5});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 1500});
                expect(fog.properties.get('star-intensity')).toEqual(0.25);
                fog.recalculate({zoom: 16, now: 3000});
                expect(fog.properties.get('star-intensity')).toEqual(0.5);
                fog.recalculate({zoom: 16, now: 3500});
                expect(fog.properties.get('star-intensity')).toEqual(0.5);

                fog.set({'high-color-transition': {duration: 3000}});
                fog.set({'high-color': 'blue'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 3000});
                expect(fog.properties.get('high-color')).toEqual(new Color(0.0, 0.0, 1.0, 1));

                fog.set({'space-color-transition': {duration: 3000}});
                fog.set({'space-color': 'blue'});
                fog.updateTransitions({transition: true}, {});
                fog.recalculate({zoom: 16, now: 5000});
                expect(fog.properties.get('space-color')).toEqual(new Color(0.0, 0.0, 1.0, 1));
            });

            test('fog respects validation option', () => {
                const fog = new Fog({});
                const fogSpy = vi.spyOn(fog, '_validate');

                fog.set({color: 444}, {validate: false});
                fog.updateTransitions({transition: false}, {});
                fog.recalculate({zoom: 16, now: 10});

                expect(fogSpy).toHaveBeenCalledTimes(1);
                expect(fog.properties.get('color')).toEqual(444);
            });
        });

        describe('updating fog triggers style diffing using setFog operation', () => {
            test('removing fog', async () => {
                const style = createStyle();
                style['fog'] = {
                    "range": [2, 5],
                    "color": "white"
                };
                const map = createMap({style});
                const initStyleObj = map.style;
                vi.spyOn(initStyleObj, 'setFog');
                vi.spyOn(initStyleObj, 'setState');
                await waitFor(map, "style.load");
                map.setStyle(createStyle());
                expect(initStyleObj).toEqual(map.style);
                expect(initStyleObj.setState).toHaveBeenCalledTimes(1);
                expect(initStyleObj.setFog).toHaveBeenCalledTimes(1);
                expect(map.style.fog == null).toBeTruthy();
            });

            test('adding fog', async () => {
                const style = createStyle();
                const map = createMap({style});
                const initStyleObj = map.style;
                vi.spyOn(initStyleObj, 'setFog');
                vi.spyOn(initStyleObj, 'setState');
                await waitFor(map, "style.load");
                const styleWithFog = JSON.parse(JSON.stringify(style));

                styleWithFog['fog'] = {
                    "range": [2, 5],
                    "color": "white"
                };
                map.setStyle(styleWithFog);
                expect(initStyleObj).toEqual(map.style);
                expect(initStyleObj.setState).toHaveBeenCalledTimes(1);
                expect(initStyleObj.setFog).toHaveBeenCalledTimes(1);
                expect(map.style.fog).toBeTruthy();
            });
        });
    });

    describe('#is_Loaded', () => {
        test('Map#isSourceLoaded', async () => {
            const style = createStyle();
            const map = createMap({style});

            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("data", e => {
                    if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                        expect(map.isSourceLoaded('geojson')).toEqual(true);
                        resolve();
                    }
                });
                map.addSource('geojson', createStyleSource());
                expect(map.isSourceLoaded('geojson')).toEqual(false);
            });
        });

        test('Map#isStyleLoaded', async () => {
            const style = createStyle();
            const map = createMap({style});

            expect(map.isStyleLoaded()).toEqual(false);
            await waitFor(map, "load");
            expect(map.isStyleLoaded()).toEqual(true);
        });

        test('Map#areTilesLoaded', async () => {
            const style = createStyle();
            const map = createMap({style});
            expect(map.areTilesLoaded()).toEqual(true);
            await waitFor(map, "load");
            const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
            map.addSource('geojson', createStyleSource());
            map.style.getOwnSourceCache('geojson')._tiles[fakeTileId.key] = new Tile(fakeTileId);
            expect(map.areTilesLoaded()).toEqual(false);
            map.style.getOwnSourceCache('geojson')._tiles[fakeTileId.key].state = 'loaded';
            expect(map.areTilesLoaded()).toEqual(true);
        });
    });

    describe('#isSourceLoaded', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        async function setupIsSourceLoaded(tileState) {
            const map = createMap();
            await waitFor(map, "load");
            map.addSource('geojson', createStyleSource());
            const source = map.getSource('geojson');
            const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
            map.style.getOwnSourceCache('geojson')._tiles[fakeTileId.key] = new Tile(fakeTileId);
            map.style.getOwnSourceCache('geojson')._tiles[fakeTileId.key].state = tileState;

            return {map, source};
        }

        test('e.isSourceLoaded should return `false` if source tiles are not loaded', async () => {
            const {map} = await setupIsSourceLoaded('loading');

            await new Promise(resolve => {
                map.on("data", (e) => {
                    if (e.sourceDataType === 'metadata') {
                        expect(e.isSourceLoaded).toEqual(false);
                        resolve();
                    }
                });
            });
        });

        test('e.isSourceLoaded should return `true` if source tiles are loaded', async () => {
            const {map} = await setupIsSourceLoaded('loaded');
            await new Promise(resolve => {
                map.on("data", (e) => {
                    if (e.sourceDataType === 'metadata') {
                        expect(e.isSourceLoaded).toEqual(true);
                        resolve();
                    }
                });
            });
        });

        test('e.isSourceLoaded should return `true` if source tiles are loaded after calling `setData`', async () => {
            const {map, source} = await setupIsSourceLoaded('loaded');
            await new Promise(resolve => {
                map.on("data", (e) => {
                    if (source._data.features[0].properties.name === 'Null Island' && e.sourceDataType === 'metadata') {
                        expect(e.isSourceLoaded).toEqual(true);
                        resolve();
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
    });

    describe('#getStyle', () => {
        test('returns the style', async () => {
            const style = createStyle();
            const map = createMap({style});

            await waitFor(map, "load");
            expect(map.getStyle()).toEqual(style);
        });

        test('returns the style with added sources', async () => {
            const style = createStyle();
            const map = createMap({style});

            await waitFor(map, "load");
            map.addSource('geojson', createStyleSource());
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                sources: {geojson: createStyleSource()}
            }));
        });

        test('returns the style with added terrain', async () => {
            const style = createStyle();
            vi.spyOn(window, 'fetch').mockImplementation(async () => {
                const res = await getPNGResponse();
                return new window.Response(res);
            });
            const map = createMap({style});

            await waitFor(map, "load");
            const terrain = {source: "terrain-source-id", exaggeration: 2};
            map.addSource('terrain-source-id', {
                "type": "raster-dem",
                "tiles": [
                    "https://tiles/{z}-{x}-{y}.terrain.png"
                ]
            });
            map.setTerrain(terrain);
            await waitFor(map, "idle");
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                terrain, 'sources': map.getStyle().sources
            }));
        });

        test('returns the style with added fog', async () => {
            const style = createStyle();
            const map = createMap({style});

            await waitFor(map, "load");
            const fog = {
                "range": [2, 5],
                "color": "blue"
            };
            map.setFog(fog);

            const fogDefaults = Object
                .entries(styleSpec.fog)
                .reduce((acc, [key, value]) => {
                    acc[key] = value.default;
                    return acc;
                }, {});

            const fogWithDefaults = extend({}, fogDefaults, fog);
            expect(map.getStyle()).toEqual(extend(createStyle(), {fog: fogWithDefaults}));
            expect(map.getFog()).toBeTruthy();
        });

        test('returns the style with removed fog', async () => {
            const style = createStyle();
            style['fog'] = {
                "range": [2, 5],
                "color": "white"
            };
            const map = createMap({style});

            await waitFor(map, "load");
            map.setFog(null);
            expect(map.getStyle()).toEqual(createStyle());
            expect(map.getFog()).toEqual(null);
        });

        test('fires an error on checking if non-existant source is loaded', async () => {
            const style = createStyle();
            const map = createMap({style});

            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/There is no source with ID/);
                    resolve();
                });
                map.isSourceLoaded('geojson');
            });
        });

        test('returns the style with added layers', async () => {
            const style = createStyle();
            const map = createMap({style});
            const layer = {
                id: 'background',
                type: 'background'
            };

            await waitFor(map, "load");
            map.addLayer(layer);
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                layers: [layer]
            }));
        });

        test('a layer can be added even if a map is created without a style', () => {
            const map = createMap({deleteStyle: true});
            const layer = {
                id: 'background',
                type: 'background'
            };
            map.addLayer(layer);
        });

        test('a source can be added even if a map is created without a style', () => {
            const map = createMap({deleteStyle: true});
            const source = createStyleSource();
            map.addSource('fill', source);
        });

        test('returns the style with added source and layer', async () => {
            const style = createStyle();
            const map = createMap({style});
            const source = createStyleSource();
            const layer = {
                id: 'fill',
                type: 'fill',
                source: 'fill'
            };

            await waitFor(map, "load");
            map.addSource('fill', source);
            map.addLayer(layer);
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                sources: {fill: source},
                layers: [layer]
            }));
        });

        test('creates a new Style if diff fails', () => {
            const style = createStyle();
            const map = createMap({style});
            vi.spyOn(map.style, 'setState').mockImplementation(() => {
                throw new Error('Dummy error');
            });
            vi.spyOn(console, 'warn').mockImplementation(() => {});

            const previousStyle = map.style;
            map.setStyle(style);
            expect(map.style && map.style !== previousStyle).toBeTruthy();
        });

        test('creates a new Style if diff option is false', () => {
            const style = createStyle();
            const map = createMap({style});
            vi.spyOn(map.style, 'setState').mockImplementation(() => {
                expect.unreachable();
            });

            const previousStyle = map.style;
            map.setStyle(style, {diff: false});
            expect(map.style && map.style !== previousStyle).toBeTruthy();
        });
    });

    test('#moveLayer', async () => {
        vi.spyOn(Actor.prototype, 'send').mockImplementation(() => {});
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            const res = await getPNGResponse();
            return new window.Response(res);
        });
        const map = createMap({
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: 'vector',
                        minzoom: 1,
                        maxzoom: 10,
                        tiles: ['/test/util/fixtures/{z}/{x}/{y}.pbf']
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
        await waitFor(map, "render");
        map.moveLayer('layerId1', 'layerId2');
        expect(map.getLayer('layerId1').id).toEqual('layerId1');
        expect(map.getLayer('layerId2').id).toEqual('layerId2');
    });

    test('#getLayer', async () => {
        const layer = {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        };

        const map = createMap({
            style: extend(createStyle(), {
                sources: {
                    mapbox: {
                        type: "geojson",
                        data: {
                            "type": "FeatureCollection",
                            "features": []
                        },
                    }
                },
                layers: [layer]
            })
        });

        await waitFor(map, "render");
        const mapLayer = map.getLayer('layerId');
        expect(mapLayer.id).toEqual(layer.id);
        expect(mapLayer.type).toEqual(layer.type);
        expect(mapLayer.source).toEqual(layer.source);
    });

    describe('#resize', () => {
        test('sets width and height from container clients', () => {
            const map = createMap(),
                container = map.getContainer();

            Object.defineProperty(container, 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            map.resize();

            expect(map.transform.width).toEqual(250);
            expect(map.transform.height).toEqual(250);
        });

        test('does nothing if container size is the same', () => {
            const map = createMap();

            vi.spyOn(map.transform, 'resize');
            vi.spyOn(map.painter, 'resize');

            map.resize();

            expect(map.transform.resize.called).toBeFalsy();
            expect(map.painter.resize.called).toBeFalsy();
        });

        test('does not call stop on resize', () => {
            const map = createMap();

            Object.defineProperty(map.getContainer(), 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            vi.spyOn(map, 'stop');

            map.resize();

            expect(map.stop.called).toBeFalsy();
        });

        test('fires movestart, move, resize, and moveend events', async () => {
            const map = createMap(),
                events = [];

            Object.defineProperty(map.getContainer(), 'getBoundingClientRect',
                {value: () => ({height: 250, width: 250})});

            ['movestart', 'move', 'resize', 'moveend'].forEach((event) => {
                map.on(event, (e) => {
                    events.push(e.type);
                });
            });

            map.resize();
            expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);
        });

        test('listen to window resize event', () => {
            window.addEventListener = function(type) {
                if (type === 'resize') {
                    //restore empty function not to mess with other tests
                    window.addEventListener = function() {};
                }
            };

            createMap();
        });

        test('do not resize if trackResize is false', () => {
            const map = createMap({trackResize: false});

            vi.spyOn(map, 'stop');
            vi.spyOn(map, '_update');
            vi.spyOn(map, 'resize');

            map._onWindowResize();

            expect(map.stop.called).toBeFalsy();
            expect(map._update.called).toBeFalsy();
            expect(map.resize.called).toBeFalsy();
        });

        test('do resize if trackResize is true (default)', () => {
            const map = createMap();

            vi.spyOn(map, '_update');
            vi.spyOn(map, 'resize');

            map._onWindowResize();

            expect(map._update).toHaveBeenCalled();
            expect(map.resize).toHaveBeenCalled();
        });
    });

    describe('#getBounds', () => {
        test('default bounds', () => {
            const map = createMap({zoom: 0});
            expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toEqual(-0);
            expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toEqual(0);

            expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
                [ -70.31249999999976, -57.326521225216965 ],
                [ 70.31249999999977, 57.32652122521695 ] ]));
        });

        test('rotated bounds', () => {
            const map = createMap({zoom: 1, bearing: 45});
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

            map.setBearing(135);
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('padded bounds', () => {
            const map = createMap({zoom: 1, bearing: 45});

            map.setPadding({
                left: 100,
                right: 10,
                top: 10,
                bottom: 10
            });

            expect(
                toFixed([[-33.5599507477, -31.7907658998], [33.5599507477, 31.7907658998]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('bounds cut off at poles (#10261)', () => {
            const map = createMap({zoom: 2, center: [0, 90], pitch: 80});
            const bounds = map.getBounds();
            expect(bounds.getNorth().toFixed(6)).toBe(MAX_MERCATOR_LATITUDE.toString());
            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -23.3484820899, 77.6464759596 ], [ 23.3484820899, 85.0511287798 ]])
            );

            map.setBearing(180);
            map.setCenter({lng: 0, lat: -90});

            const sBounds = map.getBounds();
            expect(sBounds.getSouth().toFixed(6)).toBe((-MAX_MERCATOR_LATITUDE).toString());
            expect(toFixed(sBounds.toArray())).toStrictEqual(
                toFixed([[ -23.3484820899, -85.0511287798 ], [ 23.3484820899, -77.6464759596]])
            );
        });

        test('on globe', () => {
            const map = createMap({zoom: 0, projection: 'globe'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -73.8873304141, -73.8873304141, ], [ 73.8873304141, 73.8873304141]])
            );

            map.jumpTo({zoom: 0, center: [0, 90]});
            bounds = map.getBounds();
            expect(bounds.getNorth()).toBe(90);
            expect(toFixed(bounds.toArray())).toStrictEqual(toFixed([[ -180, 11.1637985859 ], [ 180, 90 ]]));

            map.jumpTo({zoom: 0, center: [0, -90]});
            bounds = map.getBounds();
            expect(bounds.getSouth()).toBe(-90);
            expect(toFixed(bounds.toArray())).toStrictEqual(toFixed([[ -180, -90 ], [ 180, -11.1637985859]]));

            map.jumpTo({zoom: 2, center: [0, 45], bearing: 0, pitch: 20});
            bounds = map.getBounds();
            expect(bounds.getNorth()).not.toBe(90);

            map.jumpTo({zoom: 2, center: [0, -45], bearing: 180, pitch: -20});
            bounds = map.getBounds();
            expect(bounds.getSouth()).not.toBe(-90);
        });

        test('on Albers', () => {
            const map = createMap({projection: 'albers'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-65.1780745470", "-85.0511290000", ],
                [ "51.0506680427", "79.9819510537" ]
            ]);

            map.jumpTo({zoom: 0, center: [-96, 37.5]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-180.0000000000", "-45.1620125974" ],
                [ "21.1488460355", "85.0511290000" ]
            ]);

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-108.2217655978", "34.8501901832" ],
                [ "-88.9997447442", "49.1066330318" ]
            ]);

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-108.2217655978", "34.8501901832" ],
                [ "-88.9997447442", "49.1066330318" ]
            ]);

            map.setPitch(50);
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-106.5868397979", "34.9358140751" ],
                [ "-77.8438130022", "58.8683265070" ]
            ]);
        });

        test('on Winkel Tripel', () => {
            const map = createMap({projection: 'winkelTripel'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-89.7369085165", "-57.5374138724" ],
                [ "89.7369085165", "57.5374138724" ]
            ]);

            map.jumpTo({zoom: 2, center: [-20, -70]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-58.0047683883", "-82.4864361385" ],
                [ "7.3269895739", "-57.3283436312" ]
            ]);

            map.jumpTo({zoom: 2, center: [-70, -20]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-92.4701297641", "-34.6981068954" ],
                [ "-51.1668245330", "-5.6697541071" ]
            ]);

            map.jumpTo({pitch: 50, bearing: -20});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-111.9596616309", "-38.1908385183" ],
                [ "-52.4906377771", "22.9304574207" ]
            ]);
        });

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

    describe('#setMaxBounds', () => {
        test('constrains map bounds', () => {
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('when no argument is passed, map bounds constraints are removed', () => {
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]])
            ).toEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()));
        });

        test('should not zoom out farther than bounds', () => {
            const map = createMap();
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(map.setZoom(0).getZoom()).not.toEqual(0);
        });

        test('throws on invalid bounds', () => {
            const map = createMap({zoom:0});
            expect(() => {
                map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
            }).toThrowError(Error);
            expect(() => {
                map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
            }).toThrowError(Error);
        });

        function toFixed(bounds) {
            const n = 9;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }
    });

    describe('#getMaxBounds', () => {
        test('returns null when no bounds set', () => {
            const map = createMap({zoom:0});
            expect(map.getMaxBounds()).toEqual(null);
        });

        test('returns bounds', () => {
            const map = createMap({zoom:0});
            const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]];
            map.setMaxBounds(bounds);
            expect(map.getMaxBounds().toArray()).toEqual(bounds);
        });
    });

    describe('#getRenderWorldCopies', () => {
        test('initially false', () => {
            const map = createMap({renderWorldCopies: false});
            expect(map.getRenderWorldCopies()).toEqual(false);
        });

        test('initially true', () => {
            const map = createMap({renderWorldCopies: true});
            expect(map.getRenderWorldCopies()).toEqual(true);
        });
    });

    describe('#setRenderWorldCopies', () => {
        test('initially false', () => {
            const map = createMap({renderWorldCopies: false});
            map.setRenderWorldCopies(true);
            expect(map.getRenderWorldCopies()).toEqual(true);
        });

        test('initially true', () => {
            const map = createMap({renderWorldCopies: true});
            map.setRenderWorldCopies(false);
            expect(map.getRenderWorldCopies()).toEqual(false);
        });

        test('undefined', () => {
            const map = createMap({renderWorldCopies: false});
            map.setRenderWorldCopies(undefined);
            expect(map.getRenderWorldCopies()).toEqual(true);
        });

        test('null', () => {
            const map = createMap({renderWorldCopies: true});
            map.setRenderWorldCopies(null);
            expect(map.getRenderWorldCopies()).toEqual(false);
        });
    });

    test('#setMinZoom', async () => {
        const map = createMap({zoom:5});

        const onZoomStart = vi.fn();
        const onZoom = vi.fn();
        const onZoomEnd = vi.fn();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMinZoom(3.5);

        expect(onZoomStart).toHaveBeenCalledTimes(1);
        expect(onZoom).toHaveBeenCalledTimes(1);
        expect(onZoomEnd).toHaveBeenCalledTimes(1);

        map.setZoom(1);

        expect(onZoomStart).toHaveBeenCalledTimes(2);
        expect(onZoom).toHaveBeenCalledTimes(2);
        expect(onZoomEnd).toHaveBeenCalledTimes(2);

        expect(map.getZoom()).toEqual(3.5);
    });

    test('unset minZoom', () => {
        const map = createMap({minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        expect(map.getZoom()).toEqual(1);
    });

    test('#getMinZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMinZoom()).toEqual(-2);
        map.setMinZoom(10);
        expect(map.getMinZoom()).toEqual(10);
    });

    test('ignore minZooms over maxZoom', () => {
        const map = createMap({zoom:2, maxZoom:5});
        expect(() => {
            map.setMinZoom(6);
        }).toThrowError();
        map.setZoom(0);
        expect(map.getZoom()).toEqual(0);
    });

    test('#setMaxZoom', async () => {
        const map = createMap({zoom:0});

        const onZoomStart = vi.fn();
        const onZoom = vi.fn();
        const onZoomEnd = vi.fn();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMaxZoom(3.5);

        expect(onZoomStart).toHaveBeenCalledTimes(1);
        expect(onZoom).toHaveBeenCalledTimes(1);
        expect(onZoomEnd).toHaveBeenCalledTimes(1);

        map.setZoom(4);

        expect(onZoomStart).toHaveBeenCalledTimes(2);
        expect(onZoom).toHaveBeenCalledTimes(2);
        expect(onZoomEnd).toHaveBeenCalledTimes(2);

        expect(map.getZoom()).toEqual(3.5);
    });

    test('unset maxZoom', () => {
        const map = createMap({maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        expect(map.getZoom()).toEqual(6);
    });

    test('#getMaxZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMaxZoom()).toEqual(22);
        map.setMaxZoom(10);
        expect(map.getMaxZoom()).toEqual(10);
    });

    test('ignore maxZooms over minZoom', () => {
        const map = createMap({minZoom:5});
        expect(() => {
            map.setMaxZoom(4);
        }).toThrowError();
        map.setZoom(5);
        expect(map.getZoom()).toEqual(5);
    });

    test('throw on maxZoom smaller than minZoom at init', () => {
        expect(() => {
            createMap({minZoom:10, maxZoom:5});
        }).toThrowError(`maxZoom must be greater than or equal to minZoom`);
    });

    test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
        expect(() => {
            createMap({minZoom:1, maxZoom:0});
        }).toThrowError(`maxZoom must be greater than or equal to minZoom`);
    });

    test('#setMinPitch', async () => {
        const map = createMap({pitch: 20});

        const onPitchStart = vi.fn();
        const onPitch = vi.fn();
        const onPitchEnd = vi.fn();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMinPitch(10);

        expect(onPitchStart).toHaveBeenCalledTimes(1);
        expect(onPitch).toHaveBeenCalledTimes(1);
        expect(onPitchEnd).toHaveBeenCalledTimes(1);

        map.setPitch(0);

        expect(onPitchStart).toHaveBeenCalledTimes(2);
        expect(onPitch).toHaveBeenCalledTimes(2);
        expect(onPitchEnd).toHaveBeenCalledTimes(2);

        expect(map.getPitch()).toEqual(10);
    });

    test('unset minPitch', () => {
        const map = createMap({minPitch: 20});
        map.setMinPitch(null);
        map.setPitch(0);
        expect(map.getPitch()).toEqual(0);
    });

    test('#getMinPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMinPitch()).toEqual(0);
        map.setMinPitch(10);
        expect(map.getMinPitch()).toEqual(10);
    });

    test('ignore minPitchs over maxPitch', () => {
        const map = createMap({pitch: 0, maxPitch: 10});
        expect(() => {
            map.setMinPitch(20);
        }).toThrowError();
        map.setPitch(0);
        expect(map.getPitch()).toEqual(0);
    });

    test('#setMaxPitch', async () => {
        const map = createMap({pitch: 0});

        const onPitchStart = vi.fn();
        const onPitch = vi.fn();
        const onPitchEnd = vi.fn();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMaxPitch(10);

        expect(onPitchStart).toHaveBeenCalledTimes(1);
        expect(onPitch).toHaveBeenCalledTimes(1);
        expect(onPitchEnd).toHaveBeenCalledTimes(1);

        map.setPitch(20);

        expect(onPitchStart).toHaveBeenCalledTimes(2);
        expect(onPitch).toHaveBeenCalledTimes(2);
        expect(onPitchEnd).toHaveBeenCalledTimes(2);

        expect(map.getPitch()).toEqual(10);
    });

    test('unset maxPitch', () => {
        const map = createMap({maxPitch:10});
        map.setMaxPitch(null);
        map.setPitch(20);
        expect(map.getPitch()).toEqual(20);
    });

    test('#getMaxPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMaxPitch()).toEqual(85);
        map.setMaxPitch(10);
        expect(map.getMaxPitch()).toEqual(10);
    });

    test('ignore maxPitchs over minPitch', () => {
        const map = createMap({minPitch:10});
        expect(() => {
            map.setMaxPitch(0);
        }).toThrowError();
        map.setPitch(10);
        expect(map.getPitch()).toEqual(10);
    });

    test('throw on maxPitch smaller than minPitch at init', () => {
        expect(() => {
            createMap({minPitch: 10, maxPitch: 5});
        }).toThrowError(`maxPitch must be greater than or equal to minPitch`);
    });

    test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', () => {
        expect(() => {
            createMap({minPitch: 1, maxPitch: 0});
        }).toThrowError(`maxPitch must be greater than or equal to minPitch`);
    });

    test('throw on maxPitch greater than valid maxPitch at init', () => {
        expect(() => {
            createMap({maxPitch: 90});
        }).toThrowError(`maxPitch must be less than or equal to 85`);
    });

    test('throw on minPitch less than valid minPitch at init', () => {
        expect(() => {
            createMap({minPitch: -10});
        }).toThrowError(`minPitch must be greater than or equal to 0`);
    });

    describe('#getProjection', () => {
        test('map defaults to Mercator', () => {
            const map = createMap();
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('respects projection options object', () => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual(options);
        });

        test('respects projection options string', () => {
            const map = createMap({projection: 'albers'});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        test('composites user and default projection options', () => {
            const options = {
                name: 'albers',
                center: [12, 34]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [12, 34],
                parallels: [29.5, 45.5]
            });
        });

        test('does not composite user and default projection options for non-conical projections', () => {
            const options = {
                name: 'naturalEarth',
                center: [12, 34]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual({
                name: 'naturalEarth',
                center: [0, 0]
            });
        });

        test('returns conic projections when cylindrical functions are used', () => {
            let options = {
                name: 'albers',
                center: [12, 34],
                parallels: [40, -40]
            };
            const map = createMap({projection: options});
            expect(map.getProjection()).toEqual(options);
            options = {name: 'lambertConformalConic', center: [20, 25], parallels: [30, -30]};
            map.setProjection(options);
            expect(map.getProjection()).toEqual(options);
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('returns Albers projection at high zoom', async () => {
            const map = createMap({projection: 'albers'});
            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
            expect(map.getProjection()).toEqual(map.transform.getProjection());
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('returns globe projection at low zoom', async () => {
            const map = createMap({projection: 'globe'});
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'globe',
                center: [0, 0],
            });
            expect(map.getProjection()).toEqual(map.transform.getProjection());
            expect(map._showingGlobe()).toBeTruthy();
        });

        test('returns globe projection at high zoom', async () => {
            const map = createMap({projection: 'globe'});
            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.getProjection()).toEqual({
                name: 'globe',
                center: [0, 0],
            });
            expect(map.transform.getProjection()).toEqual({
                name: 'mercator',
                center: [0, 0],
            });
            expect(map._showingGlobe()).toBeFalsy();
        });

        test('Crossing globe-to-mercator zoom threshold sets mercator transition and calculates matrices', async () => {
            const map = createMap({projection: 'globe'});

            await waitFor(map, "load");

            vi.spyOn(map.transform, 'setMercatorFromTransition');
            vi.spyOn(map.transform, '_calcMatrices');

            expect(map.transform.setMercatorFromTransition).not.toHaveBeenCalled();
            expect(map.transform.mercatorFromTransition).toEqual(false);
            expect(map.transform._calcMatrices).not.toHaveBeenCalled();

            map.setZoom(7);

            await waitFor(map, "render");
            expect(map.transform.setMercatorFromTransition).toHaveBeenCalledTimes(1);
            expect(map.transform.mercatorFromTransition).toEqual(true);
            expect(map.transform._calcMatrices).toHaveBeenCalledTimes(3);
        });

        test('Changing zoom on globe does not clear tiles', async () => {
            const map = createMap({projection: 'globe'});
            vi.spyOn(map.painter, 'clearBackgroundTiles');
            await waitFor(map, "load");
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`globe`);
            expect(map._showingGlobe()).toBeTruthy();

            map.setZoom(12);
            await waitFor(map, "render");
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`mercator`);
            expect(map._showingGlobe()).toBeFalsy();

            map.setProjection({name: 'mercator'});
            expect(map.painter.clearBackgroundTiles).not.toHaveBeenCalled();
            expect(map.getProjection().name).toEqual('mercator');
            expect(map.transform.getProjection().name).toEqual(`mercator`);
            expect(map._showingGlobe()).toBeFalsy();

            map.setZoom(3);
            await waitFor(map, "render");
            map.setProjection({name: 'globe'});
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);
            expect(map.getProjection().name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual(`globe`);
            expect(map._showingGlobe()).toBeTruthy();
        });

        // Behavior described at https://github.com/mapbox/mapbox-gl-js/pull/11204
        test('runtime projection overrides style projection', async () => {
            const map = createMap({style: {
                "version": 8,
                "projection": {
                    "name": "albers"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;
            vi.spyOn(map.painter, 'clearBackgroundTiles');

            await waitFor(map, "load");
            // Defaults to style projection
            expect(style.serialize().projection.name).toEqual('albers');
            expect(map.transform.getProjection().name).toEqual('albers');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);

            // Runtime api overrides style projection
            // Stylesheet projection not changed by runtime apis
            map.setProjection({name: 'winkelTripel'});
            expect(style.serialize().projection.name).toEqual('albers');
            expect(map.transform.getProjection().name).toEqual('winkelTripel');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Runtime api overrides stylesheet projection
            style.setState(Object.assign({}, style.serialize(), {projection: {name: 'naturalEarth'}}));
            expect(style.serialize().projection.name).toEqual('naturalEarth');
            expect(map.transform.getProjection().name).toEqual('winkelTripel');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Unsetting runtime projection reveals stylesheet projection
            map.setProjection(null);
            expect(style.serialize().projection.name).toEqual('naturalEarth');
            expect(map.transform.getProjection().name).toEqual('naturalEarth');
            expect(map.getProjection().name).toEqual('naturalEarth');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(3);

            // Unsetting stylesheet projection reveals mercator
            const stylesheet = style.serialize();
            delete stylesheet.projection;
            style.setState(stylesheet);
            expect(style.serialize().projection).toEqual(undefined);
            expect(map.transform.getProjection().name).toEqual('mercator');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(4);
        });

        test('setProjection(null) reveals globe when in style', async () => {
            const map = createMap({style: {
                "version": 8,
                "projection": {
                    "name": "globe"
                },
                "sources": {},
                "layers": []
            }});
            const style = map.style;

            vi.spyOn(map.painter, 'clearBackgroundTiles');

            await waitFor(map, "load");
            // Defaults to style projection
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('globe');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(1);

            // Runtime api overrides stylesheet projection
            map.setProjection('albers');
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('albers');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(2);

            // Unsetting runtime projection reveals stylesheet projection
            map.setProjection(null);
            expect(style.serialize().projection.name).toEqual('globe');
            expect(map.transform.getProjection().name).toEqual('globe');
            expect(map.getProjection().name).toEqual('globe');
            expect(map.painter.clearBackgroundTiles).toHaveBeenCalledTimes(3);
        });
    });

    describe('#setProjection', () => {
        test('sets projection by string', () => {
            const map = createMap();
            map.setProjection('albers');
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        /**
         * @note Original test was broken.
         * @todo Add assertion before render actually happening
         * @see https://github.com/mapbox/mapbox-gl-js-internal/blob/internal/test/unit/ui/map.test.js#L2406
         */
        test.skip('throws error if invalid projection name is supplied', () => {
            expect(() => {
                return createMap({
                    projection: 'fakeProj',
                });
            }).toThrowError('Invalid projection name: fakeProj');
        });

        test('sets projection by options object', () => {
            const options = {
                name: 'albers',
                center: [12, 34],
                parallels: [10, 42]
            };
            const map = createMap();
            map.setProjection(options);
            expect(map.getProjection()).toEqual(options);
        });

        test('sets projection by options object with just name', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection()).toEqual({
                name: 'albers',
                center: [-96, 37.5],
                parallels: [29.5, 45.5]
            });
        });

        test('setProjection with no argument defaults to Mercator', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');
            map.setProjection();
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('setProjection(null) defaults to Mercator', () => {
            const map = createMap();
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');
            map.setProjection(null);
            expect(map.getProjection()).toEqual({name: 'mercator', center: [0, 0]});
        });

        test('setProjection persists after new style', async () => {
            const map = createMap();
            await waitFor(map, "style.load");
            map.setProjection({name: 'albers'});
            expect(map.getProjection().name).toEqual('albers');

            // setStyle with diffing
            map.setStyle(Object.assign({}, map.getStyle(), {projection: {name: 'winkelTripel'}}));
            expect(map.getProjection().name).toEqual('albers');
            expect(map.style.stylesheet.projection.name).toEqual('winkelTripel');

            map.setProjection({name: 'globe'});
            expect(map.getProjection().name).toEqual('globe');
            expect(map.style.stylesheet.projection.name).toEqual('winkelTripel');
            map.setProjection({name: 'lambertConformalConic'});

            // setStyle without diffing
            const s = map.getStyle();
            delete s.projection;
            map.setStyle(s, {diff: false});
            await waitFor(map, "style.load");
            expect(map.getProjection().name).toEqual('lambertConformalConic');
            expect(map.style.stylesheet.projection).toEqual(undefined);
        });
    });

    test('#remove', () => {
        const map = createMap();
        expect(map.getContainer().childNodes.length).toEqual(3);
        map.remove();
        expect(map.getContainer().childNodes.length).toEqual(0);
    });

    test('#remove calls onRemove on added controls', () => {
        const map = createMap();
        const control = {
            onRemove: vi.fn(),
            onAdd (_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        expect(control.onRemove).toHaveBeenCalledTimes(1);
    });

    test('#remove calls onRemove on added controls before style is destroyed', async () => {
        const map = createMap();
        let onRemoveCalled = 0;
        const control = {
            onRemove(map) {
                onRemoveCalled++;
                expect(map.getStyle()).toEqual(style);
            },
            onAdd (_) {
                return window.document.createElement('div');
            }
        };

        map.addControl(control);

        await waitFor(map, "style.load");
        const style = map.getStyle();
        map.remove();
        expect(onRemoveCalled).toEqual(1);
    });

    test('#remove deletes gl resources used by the globe', async () => {
        const style = extend(createStyle(), {zoom: 1});
        const map = createMap({style});
        map.setProjection("globe");

        await waitFor(map, "style.load");
        await waitFor(map, "render");
        map.remove();
        const buffers = map.painter.globeSharedBuffers;
        expect(buffers).toBeTruthy();

        const checkBuffer = (name) => buffers[name] && ('buffer' in buffers[name]);

        expect(checkBuffer('_poleIndexBuffer')).toBeFalsy();
        expect(checkBuffer('_gridBuffer')).toBeFalsy();
        expect(checkBuffer('_gridIndexBuffer')).toBeFalsy();
        expect(checkBuffer('_poleNorthVertexBuffer')).toBeFalsy();
        expect(checkBuffer('_poleSouthVertexBuffer')).toBeFalsy();
        expect(checkBuffer('_wireframeIndexBuffer')).toBeFalsy();
    });

    test('#remove deletes gl resources used by the atmosphere', async () => {
        const styleWithAtmosphere = {
            'version': 8,
            'sources': {},
            'fog':  {
                'color': '#0F2127',
                'high-color': '#000',
                'horizon-blend': 0.5,
                'space-color': '#000'
            },
            'layers': [],
            'zoom': 2,
            'projection': {
                name: 'globe'
            }
        };

        const map = createMap({style:styleWithAtmosphere});

        await waitFor(map, "style.load");
        await waitFor(map, "render");
        const atmosphereBuffer = map.painter._atmosphere.atmosphereBuffer;
        const starsVx = map.painter._atmosphere.starsVx;
        const starsIdx = map.painter._atmosphere.starsIdx;
        expect(atmosphereBuffer.vertexBuffer.buffer).toBeTruthy();
        expect(atmosphereBuffer.indexBuffer.buffer).toBeTruthy();
        expect(starsVx.buffer).toBeTruthy();
        expect(starsIdx.buffer).toBeTruthy();

        map.remove();

        expect(atmosphereBuffer.vertexBuffer.buffer).toBeFalsy();
        expect(atmosphereBuffer.indexBuffer.buffer).toBeFalsy();
        expect(starsVx.buffer).toBeFalsy();
        expect(starsIdx.buffer).toBeFalsy();
    });

    test('#remove does not leak event listeners on container', () => {
        const container = window.document.createElement('div');
        container.addEventListener = vi.fn();
        container.removeEventListener = vi.fn();

        vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
        vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});

        const map = new Map({
            container,
            testMode: true
        });
        map.remove();

        expect(container.addEventListener.callCount).toEqual(container.removeEventListener.callCount);
        expect(container.addEventListener).toHaveBeenCalledTimes(1);
        expect(container.removeEventListener).toHaveBeenCalledTimes(1);
    });

    test('#hasImage doesn\'t throw after map is removed', () => {
        const map = createMap();
        map.remove();
        expect(map.hasImage('image')).toBeFalsy();
    });

    test('#updateImage doesn\'t throw after map is removed', () => {
        const map = createMap();
        map.remove();

        const stub = vi.spyOn(console, 'error').mockImplementation(() => {});
        map.updateImage('image', {});
        expect(stub).toHaveBeenCalledTimes(1);
        expect(stub.mock.calls[0][0].message).toMatch('The map has no image with that id');
    });

    test('#addControl', () => {
        const map = createMap();
        const control = {
            onAdd(_) {
                expect(map).toEqual(_);
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        expect(map._controls[1]).toEqual(control);
    });

    test('#removeControl errors on invalid arguments', () => {
        const map = createMap();
        const control = {};
        const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

        map.addControl(control);
        map.removeControl(control);
        expect(stub).toHaveBeenCalledTimes(2);
    });

    test('#removeControl', () => {
        const map = createMap();
        const control = {
            onAdd() {
                return window.document.createElement('div');
            },
            onRemove(_) {
                expect(map).toEqual(_);
            }
        };
        map.addControl(control);
        map.removeControl(control);
        expect(map._controls.length).toEqual(1);
    });

    test('#hasControl', () => {
        const map = createMap();
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            }
        };

        const control = new Ctrl();
        expect(map.hasControl(control)).toEqual(false);
        map.addControl(control);
        expect(map.hasControl(control)).toEqual(true);
    });

    function pointToFixed(p, n = 8) {
        return {
            'x': p.x.toFixed(n),
            'y': p.y.toFixed(n)
        };
    }

    describe('#project', () => {
        let map;

        beforeEach(() => {
            map = createMap();
        });

        test('In Mercator', () => {
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: -70.3125, lat: 57.326521225}))).toEqual({x: "0.00000000", y: "0.00000000"});
        });
        test('In Globe', () => {
            map.setProjection('globe');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng:  -72.817409474, lat: 43.692434709}))).toEqual({x: "38.86205343", y: "38.86205343"});
        });
        test('In Natural Earth', () => {
            map.setProjection('naturalEarth');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: -86.861020716, lat: 61.500721712}))).toEqual({x: "0.00000000", y: "-0.00000000"});
        });
        test('In Albers', () => {
            map.setProjection('albers');
            expect(pointToFixed(map.project({lng: 0, lat: 0}))).toEqual({x: "100.00000000", y: "100.00000000"});
            expect(pointToFixed(map.project({lng: 44.605340721, lat: 79.981951054}))).toEqual({x: "-0.00000000", y: "-0.00000000"});
        });
    });

    describe('#unproject', () => {
        let map;

        beforeEach(() => {
            map = createMap();
        });

        test('In Mercator', () => {
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -70.3125, lat: 57.326521225});
        });
        test('In Globe', () => {
            map.setProjection('globe');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -67.77848443, lat: 42.791315106});
        });
        test('In Natural Earth', () => {
            map.setProjection('naturalEarth');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: -0, lat: 0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: -86.861020716, lat: 61.500721712});
        });
        test('In Albers', () => {
            map.setProjection('albers');
            expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: -0});
            expect(fixedLngLat(map.unproject([0, 0]))).toEqual({lng: 44.605340721, lat: 79.981951054});
        });
    });

    test('#listImages', async () => {
        const map = createMap();

        await waitFor(map, "load");
        expect(map.listImages().length).toEqual(0);

        map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

        const images = map.listImages();
        expect(images.length).toEqual(1);
        expect(images[0]).toEqual('img');
    });

    describe('#queryFogOpacity', () => {
        test('normal range', async () => {
            const style = createStyle();
            const map = createMap({style});
            await waitFor(map, "load");
            map.setFog({
                "range": [0.5, 10.5]
            });

            expect(map.getFog()).toBeTruthy();

            await waitFor(map, "render");
            map.setZoom(10);
            map.setCenter([0, 0]);
            map.setPitch(0);

            expect(map._queryFogOpacity([0, 0])).toEqual(0.0);

            expect(map._queryFogOpacity([50, 0])).toEqual(0.0);
            expect(map._queryFogOpacity([0, 50])).toEqual(0.0);
            expect(map._queryFogOpacity([-50, 0])).toEqual(0.0);
            expect(map._queryFogOpacity([-50, -50])).toEqual(0.0);

            map.setBearing(90);
            map.setPitch(70);

            expect(map._queryFogOpacity([0, 0])).toEqual(0.0);

            expect(map._queryFogOpacity([0.5, 0])).toEqual(0.5963390859543484);
            expect(map._queryFogOpacity([0, 0.5])).toEqual(0.31817612773293763);
            expect(map._queryFogOpacity([-0.5, 0])).toEqual(0.0021931905967484703);
            expect(map._queryFogOpacity([-0.5, -0.5])).toEqual(0.4147318524978687);

            expect(map._queryFogOpacity([2, 0])).toEqual(1.0);
            expect(map._queryFogOpacity([0, 2])).toEqual(1.0);
            expect(map._queryFogOpacity([-2, 0])).toEqual(1.0);
            expect(map._queryFogOpacity([-2, -2])).toEqual(1.0);

            map.transform.fov = 30;

            expect(map._queryFogOpacity([0.5, 0])).toEqual(0.5917784571074153);
            expect(map._queryFogOpacity([0, 0.5])).toEqual(0.2567224170602245);
            expect(map._queryFogOpacity([-0.5, 0])).toEqual(0);
            expect(map._queryFogOpacity([-0.5, -0.5])).toEqual(0.2727527139608868);
        });

        test('inverted range', async () => {
            const style = createStyle();
            const map = createMap({style});
            await waitFor(map, "load");
            map.setFog({
                "range": [10.5, 0.5]
            });

            expect(map.getFog()).toBeTruthy();

            await waitFor(map, "render");
            map.setZoom(10);
            map.setCenter([0, 0]);
            map.setBearing(90);
            map.setPitch(70);

            expect(map._queryFogOpacity([0, 0])).toEqual(1.0);

            expect(map._queryFogOpacity([0.5, 0])).toEqual(0.961473076058084);
            expect(map._queryFogOpacity([0, 0.5])).toEqual(0.9841669559435576);
            expect(map._queryFogOpacity([-0.5, 0])).toEqual(0.9988871471476187);
            expect(map._queryFogOpacity([-0.5, -0.5])).toEqual(0.9784993261529342);
        });

        test('identical range', async () => {
            const style = createStyle();
            const map = createMap({style});
            await waitFor(map, "load");
            map.setFog({
                "range": [0, 0]
            });

            expect(map.getFog()).toBeTruthy();

            await waitFor(map, "render");
            map.setZoom(5);
            map.setCenter([0, 0]);
            map.setBearing(90);
            map.setPitch(70);

            expect(map._queryFogOpacity([0, 0])).toEqual(0);

            expect(map._queryFogOpacity([0.5, 0])).toEqual(1);
            expect(map._queryFogOpacity([0, 0.5])).toEqual(0);
            expect(map._queryFogOpacity([-0.5, 0])).toEqual(0);
            expect(map._queryFogOpacity([0, -0.5])).toEqual(0);
        });
    });

    test('#listImages throws an error if called before "load"', () => {
        const map = createMap();
        expect(() => {
            map.listImages();
        }).toThrowError(Error);
    });

    describe('#queryRenderedFeatures', () => {
        const defaultParams = {scope: '', availableImages: [], serializedLayers: {}};
        test('if no arguments provided', async () => {
            await new Promise(resolve => {
                createMap({}, (err, map) => {
                    expect(err).toBeFalsy();
                    vi.spyOn(map.style, 'queryRenderedFeatures');

                    const output = map.queryRenderedFeatures();

                    const args = map.style.queryRenderedFeatures.mock.calls[0];
                    expect(args[0]).toBeTruthy();
                    expect(args[1]).toEqual(defaultParams);
                    expect(output).toEqual([]);
                    resolve();
                });
            });
        });

        test('if only "geometry" provided', async () => {
            await new Promise(resolve => {
                createMap({}, (err, map) => {
                    expect(err).toBeFalsy();
                    vi.spyOn(map.style, 'queryRenderedFeatures');

                    const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

                    const args = map.style.queryRenderedFeatures.mock.calls[0];
                    expect(args[0]).toEqual({x: 100, y: 100}); // query geometry
                    expect(args[1]).toEqual(defaultParams); // params
                    expect(args[2]).toEqual(map.transform); // transform
                    expect(output).toEqual([]);
                    resolve();
                });

            });
        });

        test('if only "params" provided', async () => {
            await new Promise(resolve => {
                createMap({}, (err, map) => {
                    expect(err).toBeFalsy();
                    vi.spyOn(map.style, 'queryRenderedFeatures');

                    const output = map.queryRenderedFeatures({filter: ['all']});

                    const args = map.style.queryRenderedFeatures.mock.calls[0];
                    expect(args[0]).toBeTruthy();
                    expect(args[1]).toEqual({...defaultParams, filter: ['all']});
                    expect(output).toEqual([]);
                    resolve();
                });
            });
        });

        test('if both "geometry" and "params" provided', async () => {
            await new Promise(resolve => {
                createMap({}, (err, map) => {
                    expect(err).toBeFalsy();
                    vi.spyOn(map.style, 'queryRenderedFeatures');

                    const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)), {filter: ['all']});

                    const args = map.style.queryRenderedFeatures.mock.calls[0];
                    expect(args[0]).toEqual({x: 100, y: 100});
                    expect(args[1]).toEqual({...defaultParams, filter: ['all']});
                    expect(args[2]).toEqual(map.transform);
                    expect(output).toEqual([]);
                    resolve();
                });
            });
        });

        test('if "geometry" with unwrapped coords provided', async () => {
            await new Promise(resolve => {
                createMap({}, (err, map) => {
                    expect(err).toBeFalsy();
                    vi.spyOn(map.style, 'queryRenderedFeatures');

                    map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                    expect(map.style.queryRenderedFeatures.mock.calls[0][0]).toEqual({x: 612, y: 100});
                    resolve();
                });
            });
        });

        test('returns an empty array when no style is loaded', () => {
            const map = createMap({style: undefined});
            expect(map.queryRenderedFeatures()).toEqual([]);
        });
    });

    describe('#language', () => {
        test('can instantiate map with language', async () => {
            const map = createMap({language: 'uk'});
            await waitFor(map, "style.load");
            expect(map.getLanguage()).toEqual('uk');
        });

        test('can instantiate map with fallback language', async () => {
            const map = createMap({language: ['en-GB', 'en-US']});
            await waitFor(map, "style.load");
            expect(map.getLanguage()).toEqual(['en-GB', 'en-US']);
        });

        test('can instantiate map with the preferred language of the user', async () => {
            const map = createMap({language: 'auto'});
            await waitFor(map, "style.load");
            expect(map.getLanguage()).toEqual(window.navigator.language);
        });

        test('sets and gets language property', async () => {
            const map = createMap({
                style: extend(createStyle(), {
                    sources: {
                        mapbox: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    }
                })
            });

            await waitFor(map, "style.load");
            const source = map.getSource('mapbox');
            const loadSpy = vi.spyOn(source, 'load');
            const clearSourceSpy = vi.spyOn(map.style, 'clearSource');

            await new Promise(resolve => {
                source.on("data", (e) => {
                    if (e.sourceDataType === 'metadata') {
                        setTimeout(() => {
                            expect(clearSourceSpy).toHaveBeenCalledTimes(1);
                            expect(clearSourceSpy.mock.calls[clearSourceSpy.mock.calls.length - 1][0]).toEqual('mapbox');
                            resolve();
                        }, 0);
                    }
                });

                map.setLanguage('es');
            });

            expect(map.getLanguage()).toEqual('es');
            expect(loadSpy).toHaveBeenCalledTimes(1);
        });

        test('can reset language property to default', async () => {
            const map = createMap();
            await waitFor(map, "style.load");
            map.setLanguage('es');
            expect(map.getLanguage()).toEqual('es');

            map.setLanguage(['auto', 'en-GB', 'en-US']);
            expect(map.getLanguage()).toEqual([window.navigator.language, 'en-GB', 'en-US']);

            map.setLanguage([]);
            expect(map.getLanguage()).toEqual(undefined);

            map.setLanguage('auto');
            expect(map.getLanguage()).toEqual(window.navigator.language);

            map.setLanguage();
            expect(map.getLanguage()).toEqual(undefined);
        });
    });

    describe('#worldview', () => {
        test('can instantiate map with worldview', async () => {
            const map = createMap({worldview: 'JP'});
            await waitFor(map, "style.load");
            expect(map.getWorldview()).toEqual('JP');
        });

        test('sets and gets worldview property', async () => {
            const map = createMap({
                style: extend(createStyle(), {
                    sources: {
                        mapbox: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    }
                })
            });

            await waitFor(map, "style.load");
            const source = map.getSource('mapbox');
            const loadSpy = vi.spyOn(source, 'load');
            const clearSourceSpy = vi.spyOn(map.style, 'clearSource');

            await new Promise(resolve => {
                source.on("data", e => {
                    if (e.sourceDataType === 'metadata') {
                        setTimeout(() => {
                            expect(clearSourceSpy).toHaveBeenCalledTimes(1);
                            expect(clearSourceSpy.mock.calls[clearSourceSpy.mock.calls.length - 1][0]).toEqual('mapbox');
                            resolve();
                        }, 0);
                    }
                });
                map.setWorldview('JP');
            });

            expect(map.getWorldview()).toEqual('JP');
            expect(loadSpy).toHaveBeenCalledTimes(1);
        });

        test('can remove worldview property', async () => {
            const map = createMap();
            await waitFor(map, "style.load");
            map.setWorldview('JP');
            expect(map.getWorldview()).toEqual('JP');
            map.setWorldview();
            expect(map.getWorldview()).toBeFalsy();
        });
    });

    describe('#setLayoutProperty', () => {
        // t.setTimeout(2000);
        test('sets property', async () => {
            const map = createMap({
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

            await waitFor(map, "style.load");
            map.style.dispatcher.broadcast = function(key, value) {
                expect(key).toEqual('updateLayers');
                expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
            };

            map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            map.style.update({});
            expect(map.getLayoutProperty('symbol', 'text-transform')).toEqual('lowercase');
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }).toThrowError(Error);
        });

        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");

            await new Promise(resolve => {
                map.once("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        test('fires a data event on background layer', async () => {
            // background layers do not have a source
            const map = createMap({
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

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.once("data", (e) => {
                    if (e.dataType === 'style') {
                        resolve();
                    }
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
        });

        test('fires a data event on sky layer', async () => {
            // sky layers do not have a source
            const map = createMap({
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

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.once("data", (e) => {
                    if (e.dataType === 'style') {
                        resolve();
                    }
                });

                map.setLayoutProperty('sky', 'visibility', 'visible');
            });
        });

        test('sets visibility on background layer', async () => {
            // background layers do not have a source
            const map = createMap({
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

            await waitFor(map, "style.load");
            map.setLayoutProperty('background', 'visibility', 'visible');
            expect(map.getLayoutProperty('background', 'visibility')).toEqual('visible');
        });

        test('sets visibility on raster layer', async () => {
            vi.spyOn(window, 'fetch').mockImplementation(async () => {
                const res = await getPNGResponse();
                return new window.Response(res);
            });
            const map = createMap({
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

            await waitFor(map, "style.load");
            map.setLayoutProperty('satellite', 'visibility', 'visible');
            expect(map.getLayoutProperty('satellite', 'visibility')).toEqual('visible');
            await waitFor(map, "idle");
        });

        test('sets visibility on video layer', async () => {
            const map = createMap({
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

            await waitFor(map, "style.load");
            map.setLayoutProperty('shore', 'visibility', 'visible');
            expect(map.getLayoutProperty('shore', 'visibility')).toEqual('visible');
        });

        test('sets visibility on image layer', async () => {
            const map = createMap({
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

            await waitFor(map, "style.load");
            map.setLayoutProperty('image', 'visibility', 'visible');
            expect(map.getLayoutProperty('image', 'visibility')).toEqual('visible');
        });
    });

    describe('#getLayoutProperty', () => {
        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });

                map.getLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });
    });

    describe('#setPaintProperty', () => {
        // t.setTimeout(2000);
        test('sets property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background"
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setPaintProperty('background', 'background-color', 'red');
            expect(map.getPaintProperty('background', 'background-color')).toEqual('red');
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setPaintProperty('background', 'background-color', 'red');
            }).toThrowError(Error);
        });

        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });

                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });
    });

    describe('#setFeatureState', () => {
        test('sets state', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(true);
        });
        test('works with string ids', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toEqual(true);
        });
        test('parses feature id as an int', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: '12345'}, {'hover': true});
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(true);
        });
        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);
        });
        test('fires an error if source not found', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/source/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        test('fires an error if sourceLayer not provided for a vector source', async () => {
            const map = createMap({
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
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/sourceLayer/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        test('fires an error if id not provided', async () => {
            const map = createMap({
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
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/id/);
                    resolve();
                });

                map.setFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
    });

    describe('#removeFeatureState', () => {
        test('accepts "0" id', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 0}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toEqual(undefined);
            expect(fState.click).toEqual(true);
        });
        test('accepts string id', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true, 'click': true});
            map.removeFeatureState({source: 'geojson', id: 'foo'}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
            expect(fState.hover).toEqual(undefined);
            expect(fState.click).toEqual(true);
        });
        test('remove specific state property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            map.removeFeatureState({source: 'geojson', id: 12345}, 'hover');
            const fState = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState.hover).toEqual(undefined);
        });
        test('remove all state properties of one feature', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1});

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.hover).toEqual(undefined);
            expect(fState.foo).toEqual(undefined);
        });
        test('remove properties for zero-based feature IDs.', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 0});

            const fState = map.getFeatureState({source: 'geojson', id: 0});
            expect(fState.hover).toEqual(undefined);
            expect(fState.foo).toEqual(undefined);
        });
        test('other properties persist when removing specific property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson', id: 1}, 'hover');

            const fState = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState.foo).toEqual(true);
        });
        test('remove all state properties of all features in source', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson'});

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toEqual(undefined);
            expect(fState1.foo).toEqual(undefined);

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toEqual(undefined);
            expect(fState2.foo).toEqual(undefined);
        });
        test('specific state deletion should not interfere with broader state deletion', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

            map.removeFeatureState({source: 'geojson', id: 1});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState1 = map.getFeatureState({source: 'geojson', id: 1});
            expect(fState1.hover).toEqual(undefined);

            map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

            const fState2 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState2.hover).toEqual(undefined);

            map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});
            map.removeFeatureState({source: 'geojson'});
            map.removeFeatureState({source: 'geojson', id: 2}, 'foo');

            const fState3 = map.getFeatureState({source: 'geojson', id: 2});
            expect(fState3.hover).toEqual(undefined);
        });
        test('add/remove and remove/add state', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            map.removeFeatureState({source: 'geojson', id: 12345});
            map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

            const fState1 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState1.hover).toEqual(true);

            map.removeFeatureState({source: 'geojson', id: 12345});

            const fState2 = map.getFeatureState({source: 'geojson', id: 12345});
            expect(fState2.hover).toEqual(undefined);
        });
        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.removeFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);
        });
        test('fires an error if source not found', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/source/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        test('fires an error if sourceLayer not provided for a vector source', async () => {
            const map = createMap({
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
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/sourceLayer/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        test('fires an error if state property is provided without a feature id', async () => {
            const map = createMap({
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
            await waitFor(map, "load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/id/);
                    resolve();
                });

                map.removeFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
    });

    describe('error event', () => {
        test('logs errors to console when it has NO listeners', () => {
            const map = createMap();
            const stub = vi.spyOn(console, 'error').mockImplementation(() => {});
            const error = new Error('test');
            map.fire(new ErrorEvent(error));
            expect(stub).toHaveBeenCalledTimes(1);
            expect(stub.mock.calls[0][0]).toEqual(error);
        });

        test('calls listeners', async () => {
            const map = createMap();
            const error = new Error('test');
            await new Promise(resolve => {
                map.on("error", (event) => {
                    expect(event.error).toEqual(error);
                    resolve();
                });
                map.fire(new ErrorEvent(error));
            });
        });
    });

    test('render stabilizes', async () => {
        const style = createStyle();
        style.sources.mapbox = {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: ['/test/util/fixtures/{z}/{x}/{y}.pbf']
        };
        style.layers.push({
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        });

        let timer;
        const map = createMap({style});
        await waitFor(map, "render");
        if (timer) clearTimeout(timer);
        await new Promise(resolve => {
            timer = setTimeout(() => {
                expect(map._frameId).toBeFalsy();
                resolve();
            }, 100);
        });
    });

    test('no render after idle event', async () => {
        const style = createStyle();
        const map = createMap({style});
        await waitFor(map, "idle");
        map.on('render', expect.unreachable);
        setTimeout(() => {}, 100);
    });

    test('no idle event during move', async () => {
        const style = createStyle();
        const map = createMap({style, fadeDuration: 0});
        await waitFor(map, "idle");
        map.zoomTo(0.5, {duration: 100});
        expect(map.isMoving()).toBeTruthy();
        await waitFor(map, "idle");
        expect(!map.isMoving()).toBeTruthy();
    });

    test('#removeLayer restores Map#loaded() to true', async () => {
        const map = createMap({
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

        await waitFor(map, "render");
        map.removeLayer('layerId');
        await waitFor(map, "render");
        if (map.loaded()) {
            map.remove();
        }
    });

    test('stops camera animation on mousedown when interactive', () => {
        const map = createMap({interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toEqual(false);

        map.remove();
    });

    test('continues camera animation on mousedown when non-interactive', () => {
        const map = createMap({interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toEqual(true);

        map.remove();
    });

    test('stops camera animation on touchstart when interactive', () => {
        const map = createMap({interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer(), {touches: [constructTouch(map.getCanvasContainer(), {target: map.getCanvas(), clientX: 0, clientY: 0})]});
        expect(map.isEasing()).toEqual(false);

        map.remove();
    });

    test('continues camera animation on touchstart when non-interactive', () => {
        const map = createMap({interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer());
        expect(map.isEasing()).toEqual(true);

        map.remove();
    });

    test('should not have tabindex attribute when non-interactive', () => {
        const map = createMap({interactive: false});

        expect(map.getCanvas().getAttribute('tabindex')).toBeFalsy();

        map.remove();
    });

    test('should calculate correct canvas size when transform css property is applied', () => {
        const map = createMap();
        vi.stubGlobal(
            'getComputedStyle',
            () => ({transform: 'matrix(0.5, 0, 0, 0.5, 0, 0)'})
        );

        map.resize();

        expect(map._containerWidth).toEqual(400);
        expect(map._containerHeight).toEqual(400);
    });

    describe('CSS warning', () => {
        let container;
        beforeEach(() => {
            container = window.document.createElement('div');
            window.document.body.appendChild(container);
            window.document.styleSheets[0].insertRule('.mapboxgl-canary { background-color: rgb(250, 128, 114); }', 0);
        });

        afterEach(() => {
            const [index] = Object.entries(window.document.styleSheets[0].cssRules).find(([, rule]) => {
                return rule.selectorText === '.mapboxgl-canary';
            });
            try { window.document.body.removeChild(container); } catch (err) { /* noop */ }
            try { window.document.styleSheets[0].deleteRule(index); } catch (err) { /* noop */ }
        });

        test('should not warn when CSS is present', async () => {
            const stub = vi.spyOn(console, 'warn');
            await new Promise(resolve => {
                setTimeout(() => {
                    new Map({container, testMode: true});
                    resolve();
                }, 0);
            });
            expect(stub).not.toHaveBeenCalled();
        });

        test('should warn when CSS is missing', () => {
            const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});
            new Map({container: window.document.createElement('div'), testMode: true});

            expect(stub).toHaveBeenCalledTimes(1);
        });
    });

    test('continues camera animation on resize', () => {
        const map = createMap(),
            container = map.getContainer();

        map.flyTo({center: [200, 0], duration: 100});

        Object.defineProperty(container, 'getBoundingClientRect',
            {value: () => ({height: 250, width: 250})});

        map.resize();

        expect(map.isMoving()).toBeTruthy();
    });

    test('map fires `styleimagemissing` for missing icons', async () => {
        const map = createMap();

        const id = "missing-image";

        let called;

        await new Promise(resolve => {
            map.on("styleimagemissing", e => {
                map.addImage(e.id, {width: 1, height: 1, data: new Uint8Array(4)});
                called = e.id;
                resolve();
            });
            expect(map.hasImage(id)).toBeFalsy();
            map.style.imageManager.getImages([id], '', () => {
                expect(called).toEqual(id);
                expect(map.hasImage(id)).toBeTruthy();
            });
        });
    });

    test('map does not fire `styleimagemissing` for empty icon values', async () => {
        const map = createMap();

        await waitFor(map, "load");

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

        await new Promise(resolve => {
            map.on("styleimagemissing", ({id}) => {
                expect.unreachable(`styleimagemissing fired for value ${id}`);
                resolve();
            });

            map.on("idle", resolve);
        });
    });

    test('map#setLights map#getLights', async () => {
        const map = createMap();

        await waitFor(map, "load");
        const lights = [
            {
                id: "sun_light",
                type: "directional",
                properties: {
                    "color": "rgba(255.0, 0.0, 0.0, 1.0)",
                    "intensity": 0.4,
                    "direction": [200.0, 40.0],
                    "cast-shadows": true,
                    "shadow-intensity": 0.2
                }
            },
            {
                "id": "environment",
                "type": "ambient",
                "properties": {
                    "color": "rgba(255.0, 0.0, 0.0, 1.0)",
                    "intensity": 0.4
                }
            }
        ];

        map.setLights(lights);
        expect(map.getLights()).toEqual(lights);
        map.setLights(null);
        expect(map.getLights()).toEqual([
            {
                "id": "flat",
                "properties": {},
                "type": "flat"
            }
        ]);
    });

    test('map#setLights with missing id and light type throws error', async () => {
        const map = createMap();

        await waitFor(map, "load");
        const lights = [{
            properties: {
                "color": "rgba(255.0, 0.0, 0.0, 1.0)",
                "intensity": 0.4,
                "direction": [200.0, 40.0],
                "cast-shadows": true,
                "shadow-intensity": 0.2
            }
        }];

        const stub = vi.spyOn(console, 'error').mockImplementation(() => {});
        map.setLights(lights);

        expect(stub).toHaveBeenCalledTimes(1);
    });

    describe('#snapToNorth', () => {
        test('snaps when less than < 7 degrees', async () => {
            // t.setTimeout(10000);
            const map = createMap();
            await waitFor(map, "load");
            map.setBearing(6);
            expect(map.getBearing()).toEqual(6);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(0);
        });

        test('does not snap when > 7 degrees', async () => {
            // t.setTimeout(2000);
            const map = createMap();
            await waitFor(map, "load");
            map.setBearing(8);
            expect(map.getBearing()).toEqual(8);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(8);
        });

        test('snaps when < bearingSnap', async () => {
            // t.setTimeout(2000);
            const map = createMap({"bearingSnap": 12});
            await waitFor(map, "load");
            map.setBearing(11);
            expect(map.getBearing()).toEqual(11);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(0);
        });

        test('does not snap when > bearingSnap', async () => {
            // t.setTimeout(2000);
            const map = createMap({"bearingSnap": 10});
            await waitFor(map, "load");
            map.setBearing(11);
            expect(map.getBearing()).toEqual(11);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(11);
        });
    });

    describe('map.version', () => {
        let map;
        let version;

        beforeEach(() => {
            map = createMap();
            version = map.version;
        });

        test('returns version string', () => {
            expect(version).toBeTruthy();
            expect(version).toMatch(/^3\.[0-9]+\.[0-9]+(-(dev|alpha|beta|rc)\.[1-9])?$/);
        });
        test('cannot be set', () => {
            expect(() => {
                map.version = "2.0.0-beta.9";
            }).toThrowError(TypeError);
            expect(map.version).not.toBe("2.0.0-beta.9");
            expect(map.version).toBe(version);
        });
    });

    describe('#queryTerrainElevation', () => {
        test('no elevation set', () => {
            const map = createMap();
            let elevation = map.queryTerrainElevation([25, 60]);
            expect(elevation).toBeFalsy();

            elevation = map.queryTerrainElevation([0, 0]);
            expect(elevation).toBeFalsy();
        });

        test('constant elevation', () => {
            const map = createMap();
            map.transform.elevation = createElevation(() => 100, 1.0);

            let elevation = map.queryTerrainElevation([25, 60]);
            expect(elevation).toEqual(100);

            elevation = map.queryTerrainElevation([0, 0]);
            expect(elevation).toEqual(100);
        });

        test('elevation with exaggeration', () => {
            const map = createMap();
            map.transform.elevation = createElevation((point) => point.x + point.y, 0.1);

            let elevation = map.queryTerrainElevation([0, 0]);
            expect(fixedNum(elevation, 7)).toEqual(0.1);

            elevation = map.queryTerrainElevation([180, 0]);
            expect(fixedNum(elevation, 7)).toEqual(0.15);

            elevation = map.queryTerrainElevation([-180, 85.051129]);
            expect(fixedNum(elevation, 7)).toEqual(-0.0);

            elevation = map.queryTerrainElevation([180, -85.051129]);
            expect(fixedNum(elevation, 6)).toEqual(0.2);
        });
    });

    describe('#isPointOnSurface', () => {
        test('Off the map', () => {
            const map = createMap();

            expect(map.isPointOnSurface([100, 100])).toEqual(true);
            expect(map.isPointOnSurface([0, 0])).toEqual(true);
            expect(map.isPointOnSurface([200, 200])).toEqual(true);

            expect(map.isPointOnSurface([-100, -100])).toEqual(false);
            expect(map.isPointOnSurface([300, 300])).toEqual(false);
        });

        test('Mercator', () => {
            const map = createMap({
                zoom: 0,
                projection: 'mercator'
            });

            expect(map.isPointOnSurface([100, 100])).toEqual(true);

            map.setPitch(90);
            expect(map.isPointOnSurface([100, 100])).toEqual(true);
            expect(map.isPointOnSurface([100, 85])).toEqual(false);
        });

        test('Globe', async () => {
            const map = createMap({
                zoom: 0,
                projection: 'globe'
            });

            await waitFor(map, "load");
            // On the Globe
            expect(map.isPointOnSurface([45, 45])).toEqual(true);
            expect(map.isPointOnSurface([135, 45])).toEqual(true);
            expect(map.isPointOnSurface([135, 135])).toEqual(true);
            expect(map.isPointOnSurface([45, 135])).toEqual(true);

            // Off the Globe
            expect(map.isPointOnSurface([25, 25])).toEqual(false);
            expect(map.isPointOnSurface([175, 25])).toEqual(false);
            expect(map.isPointOnSurface([175, 175])).toEqual(false);
            expect(map.isPointOnSurface([25, 175])).toEqual(false);

            // North pole
            map.setCenter([0, 90]);
            expect(map.isPointOnSurface([100, 100])).toEqual(true);

            // North pole with pitch
            map.setPitch(90);
            expect(map.isPointOnSurface([100, 100])).toEqual(true);
            expect(map.isPointOnSurface([100, 85])).toEqual(false);

            map.setZoom(5);
            map.setCenter([0, 0]);
            expect(map.isPointOnSurface([100, 100])).toEqual(true);
            expect(map.isPointOnSurface([100, 85])).toEqual(false);

            map.setZoom(6);
            expect(map.isPointOnSurface([100, 100])).toEqual(true);
            expect(map.isPointOnSurface([100, 85])).toEqual(false);
        });
    });
});

test('Disallow usage of FQID separator in the public APIs', async () => {
    const map = createMap();
    const spy = vi.fn();
    map.on('error', spy);

    await waitFor(map, "style.load");

    map.getLayer(null);
    map.getSource(undefined);

    map.getLayer(makeFQID('id', 'scope'));
    map.addLayer({id: makeFQID('id', 'scope')});
    map.moveLayer(makeFQID('id', 'scope'));
    map.removeLayer(makeFQID('id', 'scope'));

    map.getLayoutProperty(makeFQID('id', 'scope'));
    map.setLayoutProperty(makeFQID('id', 'scope'));

    map.getPaintProperty(makeFQID('id', 'scope'));
    map.setPaintProperty(makeFQID('id', 'scope'));

    map.setLayerZoomRange(makeFQID('id', 'scope'));

    map.getFilter(makeFQID('id', 'scope'));
    map.setFilter(makeFQID('id', 'scope'));

    map.getSource(makeFQID('id', 'scope'));
    map.addSource(makeFQID('id', 'scope'));
    map.removeSource(makeFQID('id', 'scope'));
    map.isSourceLoaded(makeFQID('id', 'scope'));

    map.getFeatureState({source: makeFQID('id', 'scope')});
    map.setFeatureState({source: makeFQID('id', 'scope')});
    map.removeFeatureState({source: makeFQID('id', 'scope')});

    map.querySourceFeatures(makeFQID('id', 'scope'));
    map.queryRenderedFeatures([0, 0], {layers: [makeFQID('id', 'scope')]});

    map.on('click', makeFQID('id', 'scope'), () => {});
    map.once('click', makeFQID('id', 'scope'), () => {});
    map.off('click', makeFQID('id', 'scope'));

    const callCount = 24;
    expect(spy.mock.calls.length).toEqual(callCount);

    const event0 = spy.mock.calls[0][0];

    expect(event0).toBeTruthy();
    expect(event0.error.message).toMatch(/can't be empty/);

    const event1 = spy.mock.calls[1][0];

    expect(event1).toBeTruthy();
    expect(event1.error.message).toMatch(/can't be empty/);

    for (let i = 2; i <= callCount - 1; i++) {
        const event = spy.mock.calls[i][0];
        expect(event).toBeTruthy();
        expect(event.error).toMatch(/can't contain special symbols/);
    }
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
