import { test } from 'mapbox-gl-js-test';
import { extend } from '../../../src/util/util';
import window from '../../../src/util/window';
import Map from '../../../src/ui/map';
import { createMap } from '../../util';
import LngLat from '../../../src/geo/lng_lat';
import Tile from '../../../src/source/tile';
import { OverscaledTileID } from '../../../src/source/tile_id';
import { Event, ErrorEvent } from '../../../src/util/evented';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

import fixed from 'mapbox-gl-js-test/fixed';
const fixedNum = fixed.Num;
const fixedLngLat = fixed.LngLat;

function createStyleSource() {
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    };
}

test('Map', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
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
        t.throws(() => {
            new Map({
                container: 'anElementIdWhichDoesNotExistInTheDocument'
            });
        }, new Error("Container 'anElementIdWhichDoesNotExistInTheDocument' not found"), 'throws on invalid map container id');
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
        const map = new Map({ container: window.document.createElement('div') });

        map.on('load', fail);

        setTimeout(() => {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

        function fail() { t.ok(false); }
        function pass() { t.end(); }
    });

    t.test('#setStyle', (t) => {
        t.test('returns self', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            const map = new Map({ container: window.document.createElement('div') });
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
            const map = new Map({container: window.document.createElement('div')});
            map.transform.lngRange = [-120, 140];
            map.transform.latRange = [-60, 80];
            map.transform.resize(600, 400);
            t.equal(map.transform.zoom, 0.6983039737971012, 'map transform is constrained');
            t.ok(map.transform.unmodified, 'map transform is not modified');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -73.9749, lat: 40.7736 }));
                t.equal(fixedNum(map.transform.zoom), 12.5);
                t.equal(fixedNum(map.transform.bearing), 29);
                t.equal(fixedNum(map.transform.pitch), 50);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via options', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888]});
            t.notOk(map.transform.unmodified, 'map transform is modified by options');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
                t.equal(fixedNum(map.transform.zoom), 10);
                t.equal(fixedNum(map.transform.bearing), 0);
                t.equal(fixedNum(map.transform.pitch), 0);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via setters', (t) => {
            t.stub(Map.prototype, '_detectMissingCSS');
            const map = new Map({container: window.document.createElement('div')});
            t.ok(map.transform.unmodified);
            map.setZoom(10);
            map.setCenter([-77.0186, 38.8888]);
            t.notOk(map.transform.unmodified, 'map transform is modified via setters');
            map.setStyle(createStyle());
            map.on('style.load', () => {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
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

        t.end();
    });

    t.test('#is_Loaded', (t)=>{

        t.test('Map#isSourceLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});

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
            const map = createMap(t, {style: style});

            t.equal(map.isStyleLoaded(), false, 'false before style has loaded');
            map.on('load', () => {
                t.equal(map.isStyleLoaded(), true, 'true when style is loaded');
                t.end();
            });
        });

        t.test('Map#areTilesLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});
            t.equal(map.areTilesLoaded(), true, 'returns true if there are no sources on the map');
            map.on('load', ()=>{

                map.addSource('geojson', createStyleSource());
                map.style.sourceCaches.geojson._tiles.fakeTile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0));
                t.equal(map.areTilesLoaded(), false, 'returns false if tiles are loading');
                map.style.sourceCaches.geojson._tiles.fakeTile.state = 'loaded';
                t.equal(map.areTilesLoaded(), true, 'returns true if tiles are loaded');
                t.end();
            });
        });
        t.end();
    });

    t.test('#getStyle', (t) => {
        t.test('returns the style', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});

            map.on('load', () => {
                t.deepEqual(map.getStyle(), style);
                t.end();
            });
        });

        t.test('returns the style with added sources', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});

            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                t.end();
            });
        });

        t.test('fires an error on checking if non-existant source is loaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});

            map.on('load', () => {
                map.on('error', ({ error }) => {
                    t.match(error.message, /There is no source with ID/);
                    t.end();
                });
                map.isSourceLoaded('geojson');
            });
        });

        t.test('returns the style with added layers', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});
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

        t.test('returns the style with added source and layer', (t) => {
            const style = createStyle();
            const map = createMap(t, {style: style});
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
                    sources: { fill: source },
                    layers: [layer]
                }));
                t.end();
            });
        });

        t.test('creates a new Style if diff fails', (t) => {
            const style = createStyle();
            const map = createMap(t, { style: style });
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
            const map = createMap(t, { style: style });
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

            Object.defineProperty(container, 'clientWidth', {value: 250});
            Object.defineProperty(container, 'clientHeight', {value: 250});
            map.resize();

            t.equal(map.transform.width, 250);
            t.equal(map.transform.height, 250);

            t.end();
        });

        t.test('fires movestart, move, resize, and moveend events', (t) => {
            const map = createMap(t),
                events = [];

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
        const map = createMap(t, { zoom: 0 });
        t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
        t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

        t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
            [ -70.31249999999976, -57.326521225216965 ],
            [ 70.31249999999977, 57.32652122521695 ] ]));

        t.test('rotated bounds', (t) => {
            const map = createMap(t, { zoom: 1, bearing: 45, skipCSSStub: true });
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
        map.setMinZoom(3.5);
        map.setZoom(1);
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
        t.equal(map.getMinZoom(), 0, 'returns default value');
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
        map.setMaxZoom(3.5);
        map.setZoom(4);
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
        }, new Error(`maxZoom must be greater than minZoom`));
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', (t) => {
        t.throws(() => {
            createMap(t, {minZoom:1, maxZoom:0});
        }, new Error(`maxZoom must be greater than minZoom`));
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
            onAdd: function (_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        t.ok(control.onRemove.calledOnce);
        t.end();
    });

    t.test('#addControl', (t) => {
        const map = createMap(t);
        const control = {
            onAdd: function(_) {
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
            onAdd: function() {
                return window.document.createElement('div');
            },
            onRemove: function(_) {
                t.equal(map, _, 'onRemove() called with map');
            }
        };
        map.addControl(control);
        map.removeControl(control);
        t.equal(map._controls.length, 1, "removes removed controls from map's control array");
        t.end();

    });

    t.test('#project', (t) => {
        const map = createMap(t);
        t.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
        t.end();
    });

    t.test('#unproject', (t) => {
        const map = createMap(t);
        t.deepEqual(fixedLngLat(map.unproject([100, 100])), { lng: 0, lat: 0 });
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
                t.deepEqual(args[1], {});
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
                t.deepEqual(args[0], [{ x: 100, y: 100 }]); // query geometry
                t.deepEqual(args[1], {}); // params
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
                t.deepEqual(args[1], {filter: ['all']});
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if both "geometry" and "params" provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.ok(args[0]);
                t.deepEqual(args[1], {filter: ['all']});
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if "geometry" with unwrapped coords provided', (t) => {
            createMap(t, {}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                t.deepEqual(map.style.queryRenderedFeatures.getCall(0).args[0], [{x: 612, y: 100}]);
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /does not exist in the map\'s style and cannot be styled/);
                    t.end();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.test('fires a data event', (t) => {
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
                map.on('error', ({ error }) => {
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
                map.setFeatureState({ source: 'geojson', id: 12345}, {'hover': true});
                const fState = map.getFeatureState({ source: 'geojson', id: 12345});
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
                map.setFeatureState({ source: 'geojson', id: '12345'}, {'hover': true});
                const fState = map.getFeatureState({ source: 'geojson', id: 12345});
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
                map.setFeatureState({ source: 'geojson', id: 12345}, {'hover': true});
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /source/);
                    t.end();
                });
                map.setFeatureState({ source: 'vector', id: 12345}, {'hover': true});
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /sourceLayer/);
                    t.end();
                });
                map.setFeatureState({ source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.setFeatureState({ source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
        t.test('fires an error if id is less than zero', (t) => {
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.setFeatureState({ source: 'vector', sourceLayer: "1", id: -1}, {'hover': true});
            });
        });
        t.test('fires an error if id cannot be parsed as an int', (t) => {
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
                map.on('error', ({ error }) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.setFeatureState({ source: 'vector', sourceLayer: "1", id: 'abc'}, {'hover': true});
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
        const map = createMap(t, { style: style });
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
        map.flyTo({ center: [200, 0], duration: 100 });

        simulate.mousedown(map.getCanvasContainer());
        t.equal(map.isEasing(), false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on mousedown when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({ center: [200, 0], duration: 100 });

        simulate.mousedown(map.getCanvasContainer());
        t.equal(map.isEasing(), true);

        map.remove();
        t.end();
    });

    t.test('stops camera animation on touchstart when interactive', (t) => {
        const map = createMap(t, {interactive: true});
        map.flyTo({ center: [200, 0], duration: 100 });

        simulate.touchstart(map.getCanvasContainer());
        t.equal(map.isEasing(), false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on touchstart when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({ center: [200, 0], duration: 100 });

        simulate.touchstart(map.getCanvasContainer());
        t.equal(map.isEasing(), true);

        map.remove();
        t.end();
    });

    t.test('should not warn when CSS is present', (t) => {
        const stub = t.stub(console, 'warn');

        const styleSheet = new window.CSSStyleSheet();
        styleSheet.insertRule('.mapboxgl-canary { background-color: rgb(250, 128, 114); }', 0);
        window.document.styleSheets[0] = styleSheet;
        window.document.styleSheets.length = 1;

        new Map({ container: window.document.createElement('div') });

        t.notok(stub.calledOnce);
        t.end();
    });

    t.test('should warn when CSS is missing', (t) => {
        const stub = t.stub(console, 'warn');
        new Map({ container: window.document.createElement('div') });

        t.ok(stub.calledOnce);

        t.end();
    });

    t.test('continues camera animation on resize', (t) => {
        const map = createMap(t),
            container = map.getContainer();

        map.flyTo({ center: [200, 0], duration: 100 });

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        t.ok(map.isMoving(), 'map is still moving after resize due to camera animation');

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
