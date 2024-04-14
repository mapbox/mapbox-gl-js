
import {describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest.js';
import {createStyle} from './util.js';
import {Map} from '../../../../src/ui/map.js';
import {extend} from '../../../../src/util/util.js';
import {getPNGResponse} from '../../../util/network.js';
import {fixedLngLat, fixedNum} from '../../../util/fixed.js';
import {Event} from '../../../../src/util/evented.js';
import Fog from '../../../../src/style/fog.js';
import Color from '../../../../src/style-spec/util/color.js';
import RasterTileSource from '../../../../src/source/raster_tile_source.js';
import {LngLatBounds} from '../../../../src/geo/lng_lat.js';

describe('Map#setStyle', () => {
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

            fog.set({color: 444}, null, {validate: false});
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

});
