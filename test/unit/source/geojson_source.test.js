import {describe, test, expect, vi} from "../../util/vitest.js";
import Tile from '../../../src/source/tile.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import GeoJSONSource from '../../../src/source/geojson_source.js';
import Transform from '../../../src/geo/transform.js';
import LngLat from '../../../src/geo/lng_lat.js';
import {extend} from '../../../src/util/util.js';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        }
    };
};

const mockDispatcher = wrapDispatcher({
    send () {}
});

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

describe('GeoJSONSource#setData', () => {
    function createSource(opts) {
        opts = opts || {};
        opts = extend(opts, {data: {}});
        return new GeoJSONSource('id', opts, wrapDispatcher({
            send (type, data, callback) {
                if (callback) {
                    return setTimeout(callback, 0);
                }
            }
        }));
    }

    test('returns self', () => {
        const source = createSource();
        expect(source.setData({})).toEqual(source);
    });

    test('fires "data" event', async () => {
        const source = createSource();
        await new Promise(resolve => {
            source.once('data', () => {
                source.once('data', resolve);
                source.setData({});
            });
            source.setData({});
        });
    });

    test('fires "dataloading" event', async () => {
        const source = createSource();
        await new Promise(resolve => {
            source.on('dataloading', resolve);
            source.setData({});
        });
    });

    test('respects collectResourceTiming parameter on source', () => {
        const source = createSource({collectResourceTiming: true});
        source.map = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            }
        };
        source.actor.send = function(type, params, cb) {
            if (type === 'geojson.loadData') {
                expect(params.request.collectResourceTiming).toBeTruthy();
                setTimeout(cb, 0);
            }
        };
        source.setData('http://localhost/nonexistent');
    });
});

describe('GeoJSONSource#update', () => {
    const transform = new Transform();
    transform.resize(200, 200);
    const lngLat = LngLat.convert([-122.486052, 37.830348]);
    const point = transform.locationPoint(lngLat);
    transform.zoom = 15;
    transform.setLocationAtPoint(lngLat, point);

    test('sends initial loadData request to dispatcher', () => {
        const mockDispatcher = wrapDispatcher({
            send(message) {
                expect(message).toEqual('geojson.loadData');
            }
        });

        /* eslint-disable no-new */
        new GeoJSONSource('id', {data: {}}, mockDispatcher).setData({});
    });

    test('forwards geojson-vt options with worker request', () => {
        const mockDispatcher = wrapDispatcher({
            send(message, params) {
                expect(message).toEqual('geojson.loadData');
                expect(params.geojsonVtOptions).toEqual({
                    extent: 8192,
                    maxZoom: 10,
                    tolerance: 4,
                    buffer: 256,
                    lineMetrics: false,
                    generateId: true
                });
            }
        });

        new GeoJSONSource('id', {
            data: {},
            maxzoom: 10,
            tolerance: 0.25,
            buffer: 16,
            generateId: true
        }, mockDispatcher).setData({});
    });

    test('forwards Supercluster options with worker request', () => {
        const mockDispatcher = wrapDispatcher({
            send(message, params) {
                expect(message).toEqual('geojson.loadData');
                expect(params.superclusterOptions).toEqual({
                    maxZoom: 12,
                    minPoints: 3,
                    extent: 8192,
                    radius: 1600,
                    log: false,
                    generateId: true
                });
            }
        });

        new GeoJSONSource('id', {
            data: {},
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 100,
            clusterMinPoints: 3,
            generateId: true
        }, mockDispatcher).setData({});
    });

    test('transforms url before making request', () => {
        const mapStub = {
            _requestManager: {
                transformRequest: (url) => { return {url}; }
            }
        };
        const transformSpy = vi.spyOn(mapStub._requestManager, 'transformRequest');
        const source = new GeoJSONSource('id', {data: 'https://example.com/data.geojson'}, mockDispatcher);
        source.onAdd(mapStub);
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toEqual('https://example.com/data.geojson');
    });
    test('fires event when metadata loads', async () => {
        const mockDispatcher = wrapDispatcher({
            send(message, args, callback) {
                if (callback) {
                    setTimeout(callback, 0);
                }
            }
        });

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        await new Promise((resolve) => {
            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') resolve();
            });

            source.setData({});
        });
    });

    test('fires "error"', async () => {
        const mockDispatcher = wrapDispatcher({
            send(message, args, callback) {
                if (callback) {
                    setTimeout(callback.bind(null, 'error'), 0);
                }
            }
        });

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        await new Promise(resolve => {

            source.on('error', (err) => {
                expect(err.error).toEqual('error');
                resolve();
            });

            source.setData({});
        });
    });

    test('sends loadData request to dispatcher after data update', async () => {
        let expectedLoadDataCalls = 2;

        await new Promise(resolve => {
            const mockDispatcher = wrapDispatcher({
                send(message, args, callback) {
                    if (message === 'geojson.loadData' && --expectedLoadDataCalls <= 0) {
                        resolve();
                    }
                    if (callback) {
                        setTimeout(callback, 0);
                    }
                }
            });

            const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
            source.map = {
                transform: {}
            };

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    source.setData({});
                    source.loadTile(new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512), () => {});
                }
            });
            source.setData({});
        });
    });
});

describe('GeoJSONSource#serialize', () => {
    const mapStub = {
        _requestManager: {
            transformRequest: (url) => { return {url}; }
        }
    };
    test('serialize source with inline data', () => {
        const source = new GeoJSONSource('id', {data: hawkHill}, mockDispatcher);
        source.onAdd(mapStub);
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: hawkHill
        });
    });

    test('serialize source with url', () => {
        const source = new GeoJSONSource('id', {data: 'local://data.json'}, mockDispatcher);
        source.onAdd(mapStub);
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: 'local://data.json'
        });
    });

    test('serialize source with updated data', () => {
        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
        source.onAdd(mapStub);
        source.setData(hawkHill);
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: hawkHill
        });
    });

    test('serialize source with additional options', () => {
        const source = new GeoJSONSource('id', {data: {}, cluster: true}, mockDispatcher);
        expect(source.serialize()).toEqual({
            type: 'geojson',
            data: {},
            cluster: true
        });
    });
});
