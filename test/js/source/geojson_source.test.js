'use strict';

var test = require('tap').test;
var GeoJSONSource = require('../../../js/source/geojson_source');
var Transform = require('../../../js/geo/transform');
var LngLat = require('../../../js/geo/lng_lat');

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
        var source = new GeoJSONSource({data: {}});
        t.equal(source.setData({}), source);
        t.end();
    });

    t.test('fires change', function(t) {
        var source = new GeoJSONSource({data: {}});
        source.on('change', function() {
            t.end();
        });
        source.setData({});
    });

    t.end();
});

test('GeoJSONSource#reload', function(t) {
    t.test('before loaded', function(t) {
        var source = new GeoJSONSource({data: {}});

        t.doesNotThrow(function() {
            source.reload();
        }, null, 'reload ignored gracefully');

        t.end();
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

    t.test('sends parse request to dispatcher', function(t) {
        var source = new GeoJSONSource({data: {}});

        source.dispatcher = {
            send: function(message) {
                t.equal(message, 'parse geojson');
                t.end();
            }
        };

        source.update(transform);
    });

    t.test('forwards geojson-vt options with worker request', function(t) {
        var source = new GeoJSONSource({
            data: {},
            maxzoom: 10,
            tolerance: 0.25,
            buffer: 16
        });

        source.dispatcher = {
            send: function(message, params) {
                t.equal(message, 'parse geojson');
                t.deepEqual(params.geojsonVtOptions, {
                    extent: 8192,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256
                });
                t.end();
            }
        };

        source.update(transform);
    });

    t.test('emits change on success', function(t) {
        var source = new GeoJSONSource({data: {}});

        source.dispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback, 0);
            }
        };

        source.update(transform);

        source.on('change', function() {
            t.end();
        });
    });

    t.test('emits error on failure', function(t) {
        var source = new GeoJSONSource({data: {}});

        source.dispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback.bind(null, 'error'), 0);
            }
        };

        source.update(transform);

        source.on('error', function(err) {
            t.equal(err.error, 'error');
            t.end();
        });
    });

    t.test('clears previous tiles', function(t) {
        var source = new GeoJSONSource({data: hawkHill});

        source.used = true;
        source.dispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback, 0);
            }
        };
        source.map = {
            options: {
                maxZoom: 20
            },
            transform: new Transform()
        };

        source.map.transform.resize(512, 512);

        source.style = {};

        source.update(transform);

        source.once('change', function() {
            source.update(transform); // Load tiles

            source.setData({});
            source.update(transform);

            source.once('change', function() {
                t.deepEqual(source._pyramid.renderedIDs(), []);
                t.end();
            });
        });
    });

    t.end();
});

test('GeoJSONSource#serialize', function(t) {

    t.test('serialize source with inline data', function(t) {
        var source = new GeoJSONSource({data: hawkHill});
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.test('serialize source with url', function(t) {
        var source = new GeoJSONSource({data: 'local://data.json'});
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: 'local://data.json'
        });
        t.end();
    });

    t.test('serialize source with updated data', function(t) {
        var source = new GeoJSONSource({data: {}});
        source.setData(hawkHill);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.end();
});

test('GeoJSONSource#queryRenderedFeatures', function(t) {
    t.test('returns an empty object before loaded', function(t) {
        var source = new GeoJSONSource({data: {}});
        t.deepEqual(source.queryRenderedFeatures(), []);
        t.end();
    });
    t.end();
});
