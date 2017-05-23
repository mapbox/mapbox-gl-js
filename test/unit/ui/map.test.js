'use strict';

const test = require('mapbox-gl-js-test').test;
const util = require('../../../src/util/util');
const window = require('../../../src/util/window');
const Map = require('../../../src/ui/map');
const LngLat = require('../../../src/geo/lng_lat');

const fixed = require('mapbox-gl-js-test/fixed');
const fixedNum = fixed.Num;
const fixedLngLat = fixed.LngLat;
const fixedCoord = fixed.Coord;

function createMap(options, callback) {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'offsetHeight', {value: 200, configurable: true});

    const map = new Map(util.extend({
        container: container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        redoPlacementOnPan: false,
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

function createStyleSource() {
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    };
}

function createStyleLayer() {
    return {
        id: 'background',
        type: 'background'
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
        const map = createMap({interactive: true, style: null});
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
            const map = createMap({interactive: false});

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
                const map = createMap(options);

                t.notOk(map[handlerName].isEnabled());

                t.end();
            });
        });

        t.end();
    });

    t.test('emits load event after a style is set', (t) => {
        const map = createMap();

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
            const map = createMap(),
                style = {
                    version: 8,
                    sources: {},
                    layers: []
                };
            t.equal(map.setStyle(style), map);
            t.end();
        });

        t.test('sets up event forwarding', (t) => {
            createMap({}, (error, map) => {
                t.error(error);

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('error', recordEvent);
                map.on('data', recordEvent);
                map.on('dataloading', recordEvent);

                map.style.fire('error');
                map.style.fire('data');
                map.style.fire('dataloading');

                t.deepEqual(events, [
                    'error',
                    'data',
                    'dataloading',
                ]);

                t.end();
            });
        });

        t.test('fires *data and *dataloading events', (t) => {
            createMap({}, (error, map) => {
                t.error(error);

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('styledata', recordEvent);
                map.on('styledataloading', recordEvent);
                map.on('sourcedata', recordEvent);
                map.on('sourcedataloading', recordEvent);
                map.on('tiledata', recordEvent);
                map.on('tiledataloading', recordEvent);

                map.style.fire('data', {dataType: 'style'});
                map.style.fire('dataloading', {dataType: 'style'});
                map.style.fire('data', {dataType: 'source'});
                map.style.fire('dataloading', {dataType: 'source'});
                map.style.fire('data', {dataType: 'tile'});
                map.style.fire('dataloading', {dataType: 'tile'});

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
            const map = createMap();

            map.setStyle({version: 8, sources: {}, layers: []});
            map.setStyle({version: 8, sources: {}, layers: []});

            t.end();
        });

        t.test('style transform overrides unmodified map transform', (t) => {
            const map = createMap();
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
            const map = createMap({zoom: 10, center: [-77.0186, 38.8888]});
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
            const map = createMap();
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
            const map = createMap();
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
            const map = createMap({style: style});

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
            const map = createMap({style: style});

            t.equal(map.isStyleLoaded(), false, 'false before style has loaded');
            map.on('load', () => {
                t.equal(map.isStyleLoaded(), true, 'true when style is loaded');
                t.end();
            });
        });

        t.test('Map#areTilesLoaded', (t) => {
            const style = createStyle();
            const map = createMap({style: style});
            t.equal(map.areTilesLoaded(), true, 'returns true if there are no sources on the map');
            map.on('load', ()=>{

                map.addSource('geojson', createStyleSource());
                map.style.sourceCaches.geojson._tiles.fakeTile = {state: 'loading'};
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
            const map = createMap({style: style});

            map.on('load', () => {
                t.deepEqual(map.getStyle(), style);
                t.end();
            });
        });

        t.test('returns the style with added sources', (t) => {
            const style = createStyle();
            const map = createMap({style: style});

            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                t.deepEqual(map.getStyle(), util.extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                t.end();
            });
        });

        t.test('fires an error on checking if non-existant source is loaded', (t) => {
            const style = createStyle();
            const map = createMap({style: style});

            map.on('load', () => {
                map.on('error', (e) => {
                    t.match(e.error.message, /There is no source with ID/);
                    t.end();
                });
                map.isSourceLoaded('geojson');
            });
        });

        t.test('returns the style with added layers', (t) => {
            const style = createStyle();
            const map = createMap({style: style});

            map.on('load', () => {
                map.addLayer(createStyleLayer());
                t.deepEqual(map.getStyle(), util.extend(createStyle(), {
                    layers: [createStyleLayer()]
                }));
                t.end();
            });
        });

        t.test('returns the style with added source and layer', (t) => {
            const style = createStyle();
            const map = createMap({style: style});
            const layer = util.extend(createStyleLayer(), {
                source: createStyleSource()
            });

            map.on('load', () => {
                map.addLayer(layer);
                t.deepEqual(map.getStyle(), util.extend(createStyle(), {
                    sources: {background: createStyleSource()},
                    layers: [util.extend(createStyleLayer(), {source: 'background'})]
                }));
                t.end();
            });
        });

        t.test('creates a new Style if diff fails', (t) => {
            const style = createStyle();
            const map = createMap({ style: style });
            t.stub(map.style, 'setState').callsFake(() => {
                throw new Error('Dummy error');
            });

            const previousStyle = map.style;
            map.setStyle(style);
            t.ok(map.style && map.style !== previousStyle);
            t.end();
        });

        t.test('creates a new Style if diff option is false', (t) => {
            const style = createStyle();
            const map = createMap({ style: style });
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
        const map = createMap({
            style: util.extend(createStyle(), {
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
        const map = createMap({
            style: util.extend(createStyle(), {
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
        t.test('sets width and height from container offsets', (t) => {
            const map = createMap(),
                container = map.getContainer();

            Object.defineProperty(container, 'offsetWidth', {value: 250});
            Object.defineProperty(container, 'offsetHeight', {value: 250});
            map.resize();

            t.equal(map.transform.width, 250);
            t.equal(map.transform.height, 250);

            t.end();
        });

        t.test('fires movestart, move, resize, and moveend events', (t) => {
            const map = createMap(),
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

            createMap();
        });

        t.test('do not resize if trackResize is false', (t) => {
            const map = createMap({trackResize: false});

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
            const map = createMap();

            t.spy(map, 'stop');
            t.spy(map, '_update');
            t.spy(map, 'resize');

            map._onWindowResize();

            t.ok(map.stop.called);
            t.ok(map._update.called);
            t.ok(map.resize.called);

            t.end();
        });

        t.end();
    });

    t.test('#getBounds', (t) => {
        const map = createMap({ zoom: 0 });
        t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
        t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

        t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
            [ -70.31249999999976, -57.326521225216965 ],
            [ 70.31249999999977, 57.32652122521695 ] ]));

        t.test('rotated bounds', (t) => {
            const map = createMap({ zoom: 1, bearing: 45 });
            t.deepEqual(
                toFixed([[-49.718445552178764, 0], [49.7184455522, 0]]),
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
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]]),
                toFixed(map.getBounds().toArray())
            );
            t.end();
        });

        t.test('when no argument is passed, map bounds constraints are removed', (t) => {
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]]),
                toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray())
            );
            t.end();
        });

        t.test('should not zoom out farther than bounds', (t) => {
            const map = createMap();
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.notEqual(map.setZoom(0).getZoom(), 0);
            t.end();
        });

        t.test('throws on invalid bounds', (t) => {
            const map = createMap({zoom:0});
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

    t.test('#setMinZoom', (t) => {
        const map = createMap({zoom:5});
        map.setMinZoom(3.5);
        map.setZoom(1);
        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset minZoom', (t) => {
        const map = createMap({minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        t.equal(map.getZoom(), 1);
        t.end();
    });

    t.test('#getMinZoom', (t) => {
        const map = createMap({zoom: 0});
        t.equal(map.getMinZoom(), 0, 'returns default value');
        map.setMinZoom(10);
        t.equal(map.getMinZoom(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore minZooms over maxZoom', (t) => {
        const map = createMap({zoom:2, maxZoom:5});
        t.throws(() => {
            map.setMinZoom(6);
        });
        map.setZoom(0);
        t.equal(map.getZoom(), 0);
        t.end();
    });

    t.test('#setMaxZoom', (t) => {
        const map = createMap({zoom:0});
        map.setMaxZoom(3.5);
        map.setZoom(4);
        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset maxZoom', (t) => {
        const map = createMap({maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        t.equal(map.getZoom(), 6);
        t.end();
    });

    t.test('#getMaxZoom', (t) => {
        const map = createMap({zoom: 0});
        t.equal(map.getMaxZoom(), 22, 'returns default value');
        map.setMaxZoom(10);
        t.equal(map.getMaxZoom(), 10, 'returns custom value');
        t.end();
    });

    t.test('ignore maxZooms over minZoom', (t) => {
        const map = createMap({minZoom:5});
        t.throws(() => {
            map.setMaxZoom(4);
        });
        map.setZoom(5);
        t.equal(map.getZoom(), 5);
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init', (t) => {
        t.throws(() => {
            createMap({minZoom:10, maxZoom:5});
        }, new Error(`maxZoom must be greater than minZoom`));
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', (t) => {
        t.throws(() => {
            createMap({minZoom:1, maxZoom:0});
        }, new Error(`maxZoom must be greater than minZoom`));
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap();
        t.equal(map.getContainer().childNodes.length, 2);
        map.remove();
        t.equal(map.getContainer().childNodes.length, 0);
        t.end();
    });

    t.test('#addControl', (t) => {
        const map = createMap();
        const control = {
            onAdd: function(_) {
                t.equal(map, _, 'addTo() called with map');
                t.end();
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
    });

    t.test('#removeControl', (t) => {
        const map = createMap();
        const control = {
            onAdd: function() {
                return window.document.createElement('div');
            },
            onRemove: function(_) {
                t.equal(map, _, 'onRemove() called with map');
                t.end();
            }
        };
        map.addControl(control);
        map.removeControl(control);
    });

    t.test('#addClass', (t) => {
        const map = createMap();
        map.addClass('night');
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#removeClass', (t) => {
        const map = createMap();
        map.addClass('night');
        map.removeClass('night');
        t.ok(!map.hasClass('night'));
        t.end();
    });

    t.test('#setClasses', (t) => {
        const map = createMap();
        map.addClass('night');
        map.setClasses([]);
        t.ok(!map.hasClass('night'));

        map.setClasses(['night']);
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#getClasses', (t) => {
        const map = createMap();
        map.addClass('night');
        t.deepEqual(map.getClasses(), ['night']);
        t.end();
    });

    t.test('#project', (t) => {
        const map = createMap();
        t.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
        t.end();
    });

    t.test('#unproject', (t) => {
        const map = createMap();
        t.deepEqual(fixedLngLat(map.unproject([100, 100])), { lng: 0, lat: 0 });
        t.end();
    });

    t.test('#queryRenderedFeatures', (t) => {

        t.test('if no arguments provided', (t) => {
            createMap({}, (err, map) => {
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
            createMap({}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                t.deepEqual(args[0].map(c => fixedCoord(c)), [{ column: 0.5, row: 0.5, zoom: 0 }]); // query geometry
                t.deepEqual(args[1], {}); // params
                t.deepEqual(args[2], 0); // bearing
                t.deepEqual(args[3], 0); // zoom
                t.deepEqual(output, []);

                t.end();
            });
        });

        t.test('if only "params" provided', (t) => {
            createMap({}, (err, map) => {
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
            createMap({}, (err, map) => {
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
            createMap({}, (err, map) => {
                t.error(err);
                t.spy(map.style, 'queryRenderedFeatures');

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                const coords = map.style.queryRenderedFeatures.getCall(0).args[0].map(c => fixedCoord(c));
                t.equal(coords[0].column, 1.5);
                t.equal(coords[0].row, 0.5);
                t.equal(coords[0].zoom, 0);

                t.end();
            });
        });

        t.test('returns an empty array when no style is loaded', (t) => {
            const map = createMap({style: undefined});
            t.deepEqual(map.queryRenderedFeatures(), []);
            t.end();
        });

        t.end();
    });

    t.test('#setLayoutProperty', (t) => {
        t.test('sets property', (t) => {
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

            map.on('style.load', () => {
                map.style.dispatcher.broadcast = function(key, value) {
                    t.equal(key, 'updateLayers');
                    t.deepEqual(value.layers.map((layer) => { return layer.id; }), ['symbol']);
                };

                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
                map.style.update();
                t.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap({
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
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.style.on('error', (e) => {
                    t.match(e.error.message, /does not exist in the map\'s style and cannot be styled/);
                    t.end();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.test('fires a data event', (t) => {
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

            map.on('style.load', () => {
                map.setLayoutProperty('background', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('background', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on raster layer', (t) => {
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

            // Suppress errors because we're not loading tiles from a real URL.
            map.on('error', () => {});

            map.on('style.load', () => {
                map.setLayoutProperty('satellite', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on video layer', (t) => {
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

            map.on('style.load', () => {
                map.setLayoutProperty('shore', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('shore', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on image layer', (t) => {
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

            map.on('style.load', () => {
                map.setPaintProperty('background', 'background-color', 'red');
                t.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap({
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
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.style.on('error', (e) => {
                    t.match(e.error.message, /does not exist in the map\'s style and cannot be styled/);
                    t.end();
                });
                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });

        t.end();
    });

    t.test('error event', (t) => {
        t.test('logs errors to console when it has NO listeners', (t) => {
            const map = createMap({ style: { version: 8, sources: {}, layers: [] } });

            t.spy(map, 'fire');
            t.stub(console, 'error').callsFake((error) => {
                if (error.message === 'version: expected one of [8], 7 found') {
                    t.notOk(map.fire.calledWith('error'));
                    console.error.restore();
                    map.fire.restore();
                    t.end();
                } else {
                    console.log(error);
                }
            });

            map.setStyle({ version: 7, sources: {}, layers: [] });
        });

        t.test('calls listeners', (t) => {
            const map = createMap({ style: { version: 8, sources: {}, layers: [] } });

            t.spy(console, 'error');
            map.on('error', (event) => {
                t.equal(event.error.message, 'version: expected one of [8], 7 found');
                t.notOk(console.error.calledWith('version: expected one of [8], 7 found'));
                console.error.restore();
                t.end();
            });

            map.setStyle({ version: 7, sources: {}, layers: [] });
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
        const map = createMap({ style: style });
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
        const map = createMap({
            style: util.extend(createStyle(), {
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

    t.test('Map#isMoving', (t) => {
        t.plan(3);
        const map = createMap();

        t.equal(map.isMoving(), false, 'false before moving');

        map.on('movestart', () => {
            t.equal(map.isMoving(), true, 'true on movestart');
        });

        map.on('moveend', () => {
            t.equal(map.isMoving(), false, 'false on moveend');
        });

        map.zoomTo(5, { duration: 0 });
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
