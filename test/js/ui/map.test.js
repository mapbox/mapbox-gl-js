'use strict';

var test = require('tap').test;
var extend = require('../../../js/util/util').extend;
var window = require('../../../js/util/browser').window;
var Map = require('../../../js/ui/map');
var Style = require('../../../js/style/style');
var LngLat = require('../../../js/geo/lng_lat');
var browser = require('../../../js/util/browser');
var sinon = require('sinon');

var fixed = require('../../testutil/fixed');
var fixedNum = fixed.Num;
var fixedLngLat = fixed.LngLat;

test('Map', function(t) {
    function createMap(options) {
        return new Map(extend({
            container: {
                offsetWidth: 200,
                offsetHeight: 200,
                classList: {
                    add: function() {},
                    remove: function() {}
                }
            },
            interactive: false,
            attributionControl: false,
            trackResize: true
        }, options));
    }

    t.test('constructor', function(t) {
        var map = createMap({interactive: true});
        t.ok(map.getContainer());
        t.equal(map.getStyle(), undefined);
        t.ok(map.boxZoom.isEnabled());
        t.ok(map.doubleClickZoom.isEnabled());
        t.ok(map.dragPan.isEnabled());
        t.ok(map.dragRotate.isEnabled());
        t.ok(map.keyboard.isEnabled());
        t.ok(map.scrollZoom.isEnabled());
        t.ok(map.touchZoomRotate.isEnabled());
        t.end();
    });

    t.test('disables handlers', function(t) {
        t.test('disables all handlers', function(t) {
            var map = createMap({interactive: false});

            t.notOk(map.boxZoom.isEnabled());
            t.notOk(map.doubleClickZoom.isEnabled());
            t.notOk(map.dragPan.isEnabled());
            t.notOk(map.dragRotate.isEnabled());
            t.notOk(map.keyboard.isEnabled());
            t.notOk(map.scrollZoom.isEnabled());
            t.notOk(map.touchZoomRotate.isEnabled());

            t.end();
        });

        var handlerNames = [
            'scrollZoom',
            'boxZoom',
            'dragRotate',
            'dragPan',
            'keyboard',
            'doubleClickZoom',
            'touchZoomRotate'
        ];
        handlerNames.forEach(function(handlerName) {
            t.test('disables "' + handlerName + '" handler', function(t) {
                var options = {};
                options[handlerName] = false;
                var map = createMap(options);

                t.notOk(map[handlerName].isEnabled());

                t.end();
            });
        });

        t.end();
    });

    t.test('emits load event after a style is set', function(t) {
        var map = createMap();

        map.on('load', fail);

        setTimeout(function() {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

        function fail() { t.ok(false); }
        function pass() { t.end(); }
    });

    t.test('#setStyle', function(t) {
        t.test('returns self', function(t) {
            var map = createMap(),
                style = {
                    version: 8,
                    sources: {},
                    layers: []
                };
            t.equal(map.setStyle(style), map);
            t.end();
        });

        t.test('sets up event forwarding', function(t) {
            var map = createMap(),
                style = new Style({
                    version: 8,
                    sources: {},
                    layers: []
                });

            var events = [];

            function checkEvent(e) {
                t.equal(e.style, style);
                events.push(e.type);
            }

            map.on('style.load',    checkEvent);
            map.on('style.error',   checkEvent);
            map.on('style.change',  checkEvent);
            map.on('source.load',   checkEvent);
            map.on('source.error',  checkEvent);
            map.on('source.change', checkEvent);
            map.on('tile.add',      checkEvent);
            map.on('tile.error',    checkEvent);
            map.on('tile.remove',   checkEvent);

            map.off('style.error', map.onError);
            map.off('source.error', map.onError);
            map.off('tile.error', map.onError);
            map.off('layer.error', map.onError);

            t.plan(10);
            map.setStyle(style); // Fires load
            style.fire('error');
            style.fire('change');
            style.fire('source.load');
            style.fire('source.error');
            style.fire('source.change');
            style.fire('tile.add');
            style.fire('tile.error');
            style.fire('tile.remove');
        });

        t.test('can be called more than once', function(t) {
            var map = createMap();

            map.setStyle({version: 8, sources: {}, layers: []});
            map.setStyle({version: 8, sources: {}, layers: []});

            t.end();
        });

        t.test('style transform overrides unmodified map transform', function (t) {
            var map = createMap();
            map.transform.lngRange = [-120, 140];
            map.transform.latRange = [-60, 80];
            map.transform.resize(600, 400);
            t.equal(map.transform.zoom, 0.6983039737971012, 'map transform is constrained');
            t.ok(map.transform.unmodified, 'map transform is not modified');
            map.setStyle(createStyle());
            map.on('style.load', function () {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -73.9749, lat: 40.7736 }));
                t.equal(fixedNum(map.transform.zoom), 12.5);
                t.equal(fixedNum(map.transform.bearing), 29);
                t.equal(fixedNum(map.transform.pitch), 50);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via options', function (t) {
            var map = createMap({zoom: 10, center: [-77.0186, 38.8888]});
            t.notOk(map.transform.unmodified, 'map transform is modified by options');
            map.setStyle(createStyle());
            map.on('style.load', function () {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
                t.equal(fixedNum(map.transform.zoom), 10);
                t.equal(fixedNum(map.transform.bearing), 0);
                t.equal(fixedNum(map.transform.pitch), 0);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via setters', function (t) {
            var map = createMap();
            t.ok(map.transform.unmodified);
            map.setZoom(10);
            map.setCenter([-77.0186, 38.8888]);
            t.notOk(map.transform.unmodified, 'map transform is modified via setters');
            map.setStyle(createStyle());
            map.on('style.load', function () {
                t.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
                t.equal(fixedNum(map.transform.zoom), 10);
                t.equal(fixedNum(map.transform.bearing), 0);
                t.equal(fixedNum(map.transform.pitch), 0);
                t.end();
            });
        });

        t.end();
    });

    t.test('#getStyle', function(t) {
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

        t.test('returns the style', function(t) {
            var style = createStyle();
            var map = createMap({style: style});

            map.on('load', function () {
                t.deepEqual(map.getStyle(), style);
                t.end();
            });
        });

        t.test('returns the style with added sources', function(t) {
            var style = createStyle();
            var map = createMap({style: style});

            map.on('load', function () {
                map.addSource('geojson', createStyleSource());
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                t.end();
            });
        });

        t.test('returns the style with added layers', function(t) {
            var style = createStyle();
            var map = createMap({style: style});

            map.on('load', function () {
                map.addLayer(createStyleLayer());
                t.deepEqual(map.getStyle(), extend(createStyle(), {
                    layers: [createStyleLayer()]
                }));
                t.end();
            });
        });

        t.end();
    });

    t.test('#resize', function(t) {
        t.test('sets width and height from container offsets', function(t) {
            var map = createMap(),
                container = map.getContainer();

            container.offsetWidth = 250;
            container.offsetHeight = 250;
            map.resize();

            t.equal(map.transform.width, 250);
            t.equal(map.transform.height, 250);

            t.end();
        });

        t.test('fires movestart, move, resize, and moveend events', function(t) {
            var map = createMap(),
                events = [];

            ['movestart', 'move', 'resize', 'moveend'].forEach(function (event) {
                map.on(event, function(e) {
                    events.push(e.type);
                });
            });

            map.resize();
            t.deepEqual(events, ['movestart', 'move', 'resize', 'moveend']);

            t.end();
        });


        t.test('listen to window resize event', function (t) {
            window.addEventListener = function(type) {
                if (type === 'resize') {
                    //restore empty function not to mess with other tests
                    window.addEventListener = function() {};

                    t.end();
                }
            };

            createMap();
        });

        t.test('do not resize if trackResize is false', function (t) {
            var map = createMap({trackResize: false});

            sinon.spy(map, 'stop');
            sinon.spy(map, '_update');
            sinon.spy(map, 'resize');

            map._onWindowResize();

            t.notOk(map.stop.called);
            t.notOk(map._update.called);
            t.notOk(map.resize.called);

            t.end();
        });

        t.test('do resize if trackResize is true (default)', function (t) {
            var map = createMap();

            sinon.spy(map, 'stop');
            sinon.spy(map, '_update');
            sinon.spy(map, 'resize');

            map._onWindowResize();

            t.ok(map.stop.called);
            t.ok(map._update.called);
            t.ok(map.resize.called);

            t.end();
        });

        t.end();
    });

    t.test('#getBounds', function(t) {
        var map = createMap({ zoom: 0 });
        t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
        t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

        t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
            [ -70.31249999999976, -57.32652122521695 ],
            [ 70.31249999999977, 57.326521225216965 ] ]));

        t.test('rotated bounds', function(t) {
            var map = createMap({ zoom: 1, bearing: 45 });
            t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
                [ -49.718445552178764, -44.44541580601936 ],
                [ 49.71844555217925, 44.445415806019355 ] ]));
            t.end();
        });
        t.end();

        function toFixed(bounds) {
            var n = 10;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }
    });

    t.test('#setMaxBounds', function (t) {
        t.test('constrains map bounds', function (t) {
            var map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(toFixed(map.getBounds().toArray()), toFixed([
                [-112.5000192114, 24.2068800000],
                [-79.4531207886, 50.0642000000]]));
            t.end();
        });

        t.test('when no argument is passed, map bounds constraints are removed', function (t) {
            var map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.deepEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()), toFixed([
                [-166.28906999999964, -27.683527055417144],
                [-25.664070000000066, 73.8248206696509]]));
            t.end();
        });

        t.test('should not zoom out farther than bounds', function (t) {
            var map = createMap();
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            t.notEqual(map.setZoom(0).getZoom(), 0);
            t.end();
        });

        function toFixed(bounds) {
            var n = 10;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }

        t.end();
    });

    t.test('#setMinZoom', function(t) {
        var map = createMap({zoom:5});
        map.setMinZoom(3.5);
        map.setZoom(1);
        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset minZoom', function(t) {
        var map = createMap({minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        t.equal(map.getZoom(), 1);
        t.end();
    });

    t.test('ignore minZooms over maxZoom', function(t) {
        var map = createMap({zoom:2, maxZoom:5});
        t.throws(function() {
            map.setMinZoom(6);
        });
        map.setZoom(0);
        t.equal(map.getZoom(), 0);
        t.end();
    });

    t.test('#setMaxZoom', function (t) {
        var map = createMap({zoom:0});
        map.setMaxZoom(3.5);
        map.setZoom(4);
        t.equal(map.getZoom(), 3.5);
        t.end();
    });

    t.test('unset maxZoom', function(t) {
        var map = createMap({maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        t.equal(map.getZoom(), 6);
        t.end();
    });

    t.test('ignore maxZooms over minZoom', function(t) {
        var map = createMap({minZoom:5});
        t.throws(function() {
            map.setMaxZoom(4);
        });
        map.setZoom(5);
        t.equal(map.getZoom(), 5);
        t.end();
    });

    t.test('#remove', function(t) {
        var map = createMap(),
            removedCanvas,
            removedControls;

        map._canvasContainer.parentNode = {
            removeChild: function (child) {
                t.equal(child, map._canvasContainer);
                removedCanvas = true;
            }
        };
        map._controlContainer.parentNode = {
            removeChild: function (child) {
                t.equal(child, map._controlContainer);
                removedControls = true;
            }
        };

        t.equal(map.remove(), undefined);
        t.ok(removedCanvas);
        t.ok(removedControls);
        t.end();
    });

    t.test('#addControl', function(t) {
        var map = createMap();
        var control = {
            addTo: function(_) {
                t.equal(map, _, 'addTo() called with map');
                t.end();
            }
        };
        map.addControl(control);
    });

    t.test('#addClass', function(t) {
        var map = createMap();
        map.addClass('night');
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#removeClass', function(t) {
        var map = createMap();
        map.addClass('night');
        map.removeClass('night');
        t.ok(!map.hasClass('night'));
        t.end();
    });

    t.test('#setClasses', function(t) {
        var map = createMap();
        map.addClass('night');
        map.setClasses([]);
        t.ok(!map.hasClass('night'));

        map.setClasses(['night']);
        t.ok(map.hasClass('night'));
        t.end();
    });

    t.test('#getClasses', function(t) {
        var map = createMap();
        map.addClass('night');
        t.deepEqual(map.getClasses(), ['night']);
        t.end();
    });

    t.test('#project', function(t) {
        var map = createMap();
        t.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
        t.end();
    });

    t.test('#unproject', function(t) {
        var map = createMap();
        t.deepEqual(map.unproject([100, 100]), { lng: 0, lat: 0 });
        t.end();
    });

    t.test('#queryRenderedFeatures', function(t) {
        var map = createMap();
        map.setStyle({
            "version": 8,
            "sources": {},
            "layers": []
        });

        map.on('style.load', function() {
            var opts = {};

            t.test('normal coords', function(t) {
                map.style.queryRenderedFeatures = function (coords, o, zoom, bearing) {
                    t.deepEqual(coords, [{ column: 0.5, row: 0.5, zoom: 0 }]);
                    t.equal(o, opts);
                    t.equal(bearing, map.transform.angle);
                    t.equal(zoom, map.getZoom());
                    t.end();
                };

                map.queryRenderedFeatures(map.project(new LngLat(0, 0)), opts);
            });

            t.test('does not wrap coords', function(t) {
                map.style.queryRenderedFeatures = function (coords, o, zoom, bearing) {
                    // avoid floating point issues
                    t.equal(parseFloat(coords[0].column.toFixed(4)), 1.5);
                    t.equal(coords[0].row, 0.5);
                    t.equal(coords[0].zoom, 0);

                    t.equal(o, opts);
                    t.equal(bearing, map.transform.angle);
                    t.equal(zoom, map.getZoom());

                    t.end();
                };

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)), opts);
            });

            t.end();
        });
    });

    t.test('#setLayoutProperty', function (t) {
        t.test('sets property', function (t) {
            var map = createMap({
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

            map.on('style.load', function () {
                map.style.dispatcher.broadcast = function(key, value) {
                    t.equal(key, 'update layers');
                    t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
                };

                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
                map.style.update();
                t.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
                t.end();
            });
        });

        t.test('sets property on parent layer', function (t) {
            var map = createMap({
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
                    }, {
                        "id": "symbol-ref",
                        "ref": "symbol"
                    }]
                }
            });

            map.on('style.load', function () {
                map.style.dispatcher.broadcast = function(key, value) {
                    t.equal(key, 'update layers');
                    t.deepEqual(value.map(function(layer) { return layer.id; }), ['symbol']);
                };

                map.setLayoutProperty('symbol-ref', 'text-transform', 'lowercase');
                map.style.update();
                t.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
                t.end();
            });
        });

        t.test('throw before loaded', function (t) {
            var map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            t.throws(function () {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }, Error, /load/i);

            t.end();
        });

        t.test('fires a style.change event', function (t) {
            // background layers do not have a source
            var map = createMap({
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

            map.on('style.load', function () {
                map.once('style.change', function (e) {
                    t.ok(e, 'change event');
                    t.end();
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
        });

        t.test('sets visibility on background layer', function (t) {
            // background layers do not have a source
            var map = createMap({
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

            map.on('style.load', function () {
                map.setLayoutProperty('background', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('background', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on raster layer', function (t) {
            var map = createMap({
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
            map.off('tile.error', map.onError);
            map.on('tile.error', function() {});

            map.on('style.load', function () {
                map.setLayoutProperty('satellite', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on video layer', function (t) {
            var map = createMap({
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

            map.on('style.load', function () {
                map.setLayoutProperty('shore', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('shore', 'visibility'), 'visible');
                t.end();
            });
        });

        t.test('sets visibility on image layer', function (t) {
            var map = createMap({
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

            map.on('style.load', function () {
                map.setLayoutProperty('image', 'visibility', 'visible');
                t.deepEqual(map.getLayoutProperty('image', 'visibility'), 'visible');
                t.end();
            });
        });

        t.end();
    });

    t.test('#setPaintProperty', function (t) {
        t.test('sets property', function (t) {
            var map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background"
                    }]
                }
            });

            map.on('style.load', function () {
                map.setPaintProperty('background', 'background-color', 'red');
                t.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
                t.end();
            });
        });

        t.test('throw before loaded', function (t) {
            var map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            t.throws(function () {
                map.setPaintProperty('background', 'background-color', 'red');
            }, Error, /load/i);

            t.end();
        });

        t.end();
    });

    t.test('#onError', function (t) {
        t.test('logs errors to console by default', function (t) {
            var error = console.error;

            console.error = function (e) {
                console.error = error;
                t.deepEqual(e.message, 'version: expected one of [8], 7 found');
                t.end();
            };

            createMap({
                style: {
                    version: 7,
                    sources: {},
                    layers: []
                }
            });
        });

        t.test('logs errors that happen during render', function (t) {
            var error = console.error;

            console.error = function (e) {
                console.error = error;
                t.deepEqual(e.message, 'in render');
                t.end();
            };

            var map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('render', function () {
                throw new Error('in render');
            });

            map._rerender = function () {};
            map._render();
        });

        t.end();
    });

    t.test('workerCount option', function(t) {
        var map = createMap({ style: createStyle() });
        t.equal(map.style.dispatcher.actors.length, browser.hardwareConcurrency - 1, 'workerCount defaults to hardwareConcurrency - 1');
        map = createMap({ style: createStyle(), workerCount: 3 });
        t.equal(map.style.dispatcher.actors.length, 3, 'workerCount option is used');
        t.throws(function () {
            createMap({ workerCount: 0 });
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
