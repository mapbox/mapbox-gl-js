'use strict';

const test = require('mapbox-gl-js-test').test;
const Tile = require('../../../js/source/tile');
const TileCoord = require('../../../js/source/tile_coord');
const GeoJSONSource = require('../../../js/source/geojson_source');
const Transform = require('../../../js/geo/transform');
const LngLat = require('../../../js/geo/lng_lat');

const mockDispatcher = {
    send: function () {}
};

const hawkHill = {
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

test('GeoJSONSource#setData', (t) => {
    function createSource() {
        return new GeoJSONSource('id', {data: {}}, {
            send: function (type, data, callback) {
                return setTimeout(callback, 0);
            }
        });
    }

    t.test('returns self', (t) => {
        const source = createSource();
        t.equal(source.setData({}), source);
        t.end();
    });

    t.test('fires "data" event', (t) => {
        const source = createSource();
        source.once('data', () => {
            source.on('data', t.end);
            source.setData({});
        });
    });

    t.test('fires "dataloading" event', (t) => {
        const source = createSource();
        source.once('data', () => {
            source.on('dataloading', t.end);
            source.setData({});
        });
    });

    t.end();
});

test('GeoJSONSource#update', (t) => {
    const transform = new Transform();
    transform.resize(200, 200);
    const lngLat = LngLat.convert([-122.486052, 37.830348]);
    const point = transform.locationPoint(lngLat);
    transform.zoom = 15;
    transform.setLocationAtPoint(lngLat, point);

    t.test('sends initial loadData request to dispatcher', (t) => {
        const mockDispatcher = {
            send: function(message) {
                t.equal(message, 'geojson.loadData');
                t.end();
            }
        };

        /* eslint-disable no-new */
        new GeoJSONSource('id', {data: {}}, mockDispatcher);
    });

    t.test('forwards geojson-vt options with worker request', (t) => {
        const mockDispatcher = {
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

    t.test('fires "source.load"', (t) => {
        const mockDispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback, 0);
            }
        };

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.on('source.load', () => {
            t.end();
        });
    });

    t.test('fires "error"', (t) => {
        const mockDispatcher = {
            send: function(message, args, callback) {
                setTimeout(callback.bind(null, 'error'), 0);
            }
        };

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.on('error', (err) => {
            t.equal(err.error, 'error');
            t.end();
        });
    });

    t.test('sends loadData request to dispatcher after data update', (t) => {
        let expectedLoadDataCalls = 2;
        const mockDispatcher = {
            send: function(message, args, callback) {
                if (message === 'geojson.loadData' && --expectedLoadDataCalls <= 0) {
                    t.end();
                }
                setTimeout(callback, 0);
            }
        };

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.map = {
            transform: {}
        };

        source.on('source.load', () => {
            source.setData({});
            source.loadTile(new Tile(new TileCoord(0, 0, 0), 512), () => {});
        });
    });

    t.end();
});

test('GeoJSONSource#serialize', (t) => {

    t.test('serialize source with inline data', (t) => {
        const source = new GeoJSONSource('id', {data: hawkHill}, mockDispatcher);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.test('serialize source with url', (t) => {
        const source = new GeoJSONSource('id', {data: 'local://data.json'}, mockDispatcher);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: 'local://data.json'
        });
        t.end();
    });

    t.test('serialize source with updated data', (t) => {
        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.setData(hawkHill);
        t.deepEqual(source.serialize(), {
            type: 'geojson',
            data: hawkHill
        });
        t.end();
    });

    t.end();
});
