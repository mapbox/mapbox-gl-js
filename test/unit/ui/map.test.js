import {describe, test, beforeEach, afterEach, expect, waitFor, vi, createMap} from '../../util/vitest.js';
import {createStyle, createStyleSource} from './map/util.js';
import {getPNGResponse} from '../../util/network.js';
import {extend} from '../../../src/util/util.js';
import {Map} from '../../../src/ui/map.js';
import Actor from '../../../src/util/actor.js';
import LngLat from '../../../src/geo/lng_lat.js';
import Tile from '../../../src/source/tile.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {ErrorEvent} from '../../../src/util/evented.js';
import simulate, {constructTouch} from '../../util/simulate_interaction.js';
import {fixedNum} from '../../util/fixed.js';
import {makeFQID} from '../../../src/util/fqid.js';

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

    test('warns when map container is not empty', () => {
        const container = window.document.createElement('div');
        container.textContent = 'Hello World';
        const stub = vi.spyOn(console, 'warn').mockImplementation(() => {});

        createMap({container, testMode: true});

        expect(stub).toHaveBeenCalledTimes(1);
    });

    test('bad map-specific token breaks map', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        createMap({accessToken:'notAToken'});
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
        expect(event.error.message).toMatch(/can't contain special symbols/);
    }
});
