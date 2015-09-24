'use strict';

var test = require('prova');
var extend = require('../../../js/util/util').extend;
var Map = require('../../../js/ui/map');
var Style = require('../../../js/style/style');
var LngLat = require('../../../js/geo/lng_lat');

test('Map', function(t) {
    function createMap(options, size) {
        size = size || 200;
        return new Map(extend({
            container: {
                offsetWidth: size,
                offsetHeight: size,
                classList: {
                    add: function() {}
                }
            },
            interactive: false,
            attributionControl: false
        }, options));
    }

    t.test('constructor', function(t) {
        var map = createMap();
        t.ok(map.getContainer());
        t.end();
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

            function styleEvent(e) {
                t.equal(e.style, style);
            }

            function sourceEvent(e) {
                t.equal(e.style, style);
            }

            function tileEvent(e) {
                t.equal(e.style, style);
            }

            map.on('style.load',    styleEvent);
            map.on('style.error',   styleEvent);
            map.on('style.change',  styleEvent);
            map.on('source.load',   sourceEvent);
            map.on('source.error',  sourceEvent);
            map.on('source.change', sourceEvent);
            map.on('tile.add',      tileEvent);
            map.on('tile.load',     tileEvent);
            map.on('tile.error',    tileEvent);
            map.on('tile.remove',   tileEvent);

            map.off('style.error', map.onError);
            map.off('source.error', map.onError);
            map.off('tile.error', map.onError);

            t.plan(10);
            map.setStyle(style); // Fires load
            style.fire('error');
            style.fire('change');
            style.fire('source.load');
            style.fire('source.error');
            style.fire('source.change');
            style.fire('tile.add');
            style.fire('tile.load');
            style.fire('tile.error');
            style.fire('tile.remove');
        });

        t.test('can be called more than once', function(t) {
            var map = createMap();

            map.setStyle({version: 8, sources: {}, layers: []});
            map.setStyle({version: 8, sources: {}, layers: []});

            t.end();
        });
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
    });

    t.test('#getBounds', function(t) {
        var map = createMap();
        t.deepEqual(parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
        t.deepEqual(parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');
        t.end();
    });

    t.test('#remove', function(t) {
        var map = createMap();
        t.equal(map.remove(), map);
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

    t.test('#batch', function(t) {
        var map = createMap();
        map.setStyle({
            version: 8,
            sources: {},
            layers: []
        });
        map.on('style.load', function() {
            map.batch(function(batch) {
                batch.addLayer({ id: 'background', type: 'background' });
            });
            t.ok(map.style.getLayer('background'), 'has background');

            t.end();
        });
    });


    t.test('#featuresAt', function(t) {
        var map = createMap();
        map.setStyle({
            "version": 8,
            "sources": {},
            "layers": []
        });

        map.on('style.load', function() {
            var callback = function () {};
            var opts = {};

            t.test('normal coords', function(t) {
                map.style.featuresAt = function (coords, o, cb) {
                    t.deepEqual(coords, { column: 0.5, row: 0.5, zoom: 0 });
                    t.equal(o, opts);
                    t.equal(cb, callback);

                    t.end();
                };

                map.featuresAt(map.project(new LngLat(0, 0)), opts, callback);
            });

            t.test('wraps coords', function(t) {
                map.style.featuresAt = function (coords, o, cb) {
                    // avoid floating point issues
                    t.equal(parseFloat(coords.column.toFixed(4)), 0.5);
                    t.equal(coords.row, 0.5);
                    t.equal(coords.zoom, 0);

                    t.equal(o, opts);
                    t.equal(cb, callback);

                    t.end();
                };

                map.featuresAt(map.project(new LngLat(360, 0)), opts, callback);
            });

            t.end();
        });
    });

    t.test('#featuresAt on a custom vector source', function() {
        var style = {
            version: 8,
            sources: {
                'us-counties': {
                    "type": "vector",
                    "maxzoom": 10,
                    "minzoom": 0,
                    "tiles": ["https://a.tiles.mapbox.com/v4/devseed.us-counties/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1IjoibW91cm5lciIsImEiOiJWWnRiWG1VIn0.j6eccFHpE3Q04XPLI7JxbA"]
                }
            },
            layers: [{
                id: 'counties',
                type: 'line',
                source: 'us-counties',
                'source-layer': 'counties',
                interactive: true
            }]
        };

        var map = createMap({
            style: style,
            center: [-74.522, 39.920],
            zoom: 7
        }, 500);

        map.on('load', function() {
            map.featuresAt([136, 231], {}, function (err, features) {
                if (err) throw err;
                var ids = features.map(function (feat) { return feat.properties.id; });
                t.same(ids, ["42101"]);
                t.end();
            });
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
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
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
                            "tiles": ["local://tiles/{z}-{x}-{y}.png"]
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

            // We're faking tiles
            map.off('tile.error', map.onError);

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
                            "urls": ["https://www.mapbox.com/drone/video/drone.mp4", "https://www.mapbox.com/drone/video/drone.webm"],
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
                            "url": "https://www.mapbox.com/drone/video/drone.mp4",
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
                t.deepEqual(map.getPaintProperty('background', 'background-color'), [1, 0, 0, 1]);
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
    });
});
