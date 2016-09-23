'use strict';

var test = require('tap').test;
var Tile = require('../../../js/source/tile');
var TileCoord = require('../../../js/source/tile_coord');
var GeoJSONSource = require('../../../js/source/geojson_source');
var Transform = require('../../../js/geo/transform');
var LngLat = require('../../../js/geo/lng_lat');

var mockDispatcher = {
    send: function () {}
};

var hawkHill = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [-122.48369693756104, 37.83381888486939],
                [-122.48348236083984, 37.83317489144141],
                [-122.48339653015138, 37.83270036637107],
                [-122.48356819152832, 37.832056363179625],
                [-122.48404026031496, 37.83114119107971],
                [-122.48404026031496, 37.83049717427869],
                [-122.48348236083984, 37.829920943955045],
                [-122.48356819152832, 37.82954808664175],
                [-122.48507022857666, 37.82944639795659],
                [-122.48610019683838, 37.82880236636284],
                [-122.48695850372314, 37.82931081282506],
                [-122.48700141906738, 37.83080223556934],
                [-122.48751640319824, 37.83168351665737],
                [-122.48803138732912, 37.832158048267786],
                [-122.48888969421387, 37.83297152392784],
                [-122.48987674713133, 37.83263257682617],
                [-122.49043464660643, 37.832937629287755],
                [-122.49125003814696, 37.832429207817725],
                [-122.49163627624512, 37.832564787218985],
                [-122.49223709106445, 37.83337825839438],
                [-122.49378204345702, 37.83368330777276]
            ]
        }
    }]
};

test('GeoJSONSource#setData', function(t) {
    t.test('returns self', function(t) {
        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        t.equal(source.setData({}), source);
        t.end();
    });

    t.test('fires change', function(t) {
        var mockDispatcher = {
            send: function (type, data, callback) {
                return callback();
            }
        };
        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.on('data', function() {
            t.end();
        });
        source.setData({});
    });

    t.end();
});

test('GeoJSONSource#update', function(t) {
    var transform = new Transform();
    transform.resize(200, 200);
    var lngLat = LngLat.convert([-122.486052, 37.830348]);
    var point = transform.locationPoint(lngLat);
    transform.zoom = 15;
    transform.setLocationAtPoint(lngLat, point);

    t.test('sends initial loadData request to dispatcher', function(t) {
        var mockDispatcher = {
            send: function(message) {
                t.equal(message, 'geojson.loadData');
                t.end();
            }
        };

        /* eslint-disable no-new */
        new GeoJSONSource('id', {data: {}}, mockDispatcher);
    });

    t.test('forwards geojson-vt options with worker request', function(t) {
        var mockDispatcher = {
            send: function(message, params) {
                t.equal(message, 'geojson.loadData');
                t.deepEqual(params.geojsonVtOptions, {
                    extent: 8192,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256
                });
                t.end();
            }
        };

        new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            tolerance: 0.25,
            buffer: 16
        }, mockDispatcher);
    });

    t.test('emits load on success', function(t) {
        var mockDispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback, 0);
            }
        };

        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.on('sourceload', function() {
            t.end();
        });
    });

    t.test('emits error on failure', function(t) {
        var mockDispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback.bind(null, 'error'), 0);
            }
        };

        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.on('error', function(err) {
            t.equal(err.error, 'error');
            t.end();
        });
    });

    t.test('emits change on data update', function(t) {
        var mockDispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback, 0);
            }
        };

        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.on('sourceload', function() {
            // Note: we register this before calling setData because `change`
            // is fired synchronously within that method.  It may be worth
            // considering dezalgoing there.
            source.on('data', function () {
                t.end();
            });
            source.setData({});
        });
    });

    t.test('sends loadData request to dispatcher after data update', function(t) {
        var expectedLoadDataCalls = 2;
        var mockDispatcher = {
            send: function(message, args, callback) {
                if (message === 'geojson.loadData' && --expectedLoadDataCalls <= 0) {
                    t.end();
                }
                setTimeout(callback, 0);
            }
        };

        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.map = {
            transform: {}
        };

        source.on('sourceload', function () {
            source.setData({});
            source.loadTile(new Tile(new TileCoord(0, 0, 0), 512), function () {});
        });
    });

    t.end();
});

test('GeoJSONSource#serialize', function(t) {

    t.test('serialize source with inline data', function(t) {
        var source = new GeoJSONSource('id', {data: hawkHill}, mockDispatcher);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.test('serialize source with url', function(t) {
        var source = new GeoJSONSource('id', {data: 'local://data.json'}, mockDispatcher);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: 'local://data.json'
        });
        t.end();
    });

    t.test('serialize source with updated data', function(t) {
        var source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.setData(hawkHill);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.end();
});
