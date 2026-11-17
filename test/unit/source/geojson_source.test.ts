// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import Tile from '../../../src/source/tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import GeoJSONSource from '../../../src/source/geojson_source';
import Transform from '../../../src/geo/transform';
import LngLat from '../../../src/geo/lng_lat';
import Actor from '../../../src/util/actor';

const wrapDispatcher = (dispatcher) => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    if (dispatcher.send && !dispatcher.sendCancelable) {
        const send = dispatcher.send.bind(dispatcher);
        dispatcher.send = (type, data, options) => Promise.resolve(send(type, data, options));
        dispatcher.sendCancelable = Actor.prototype.sendCancelable;
    }
    if (dispatcher.send && !dispatcher.notify) {
        dispatcher.notify = () => {};
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    return {
        getActor() {
            return dispatcher;
        }
    };
};

const mockDispatcher = wrapDispatcher({
    async send() {}
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        opts = opts || {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        opts = Object.assign(opts, {data: {}});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return new GeoJSONSource('id', opts, wrapDispatcher({
            async send() {}
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
        // eslint-disable-next-line @typescript-eslint/require-await
        source.actor.send = async function (type, params) {
            if (type === 'geojson.loadData') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(params.request.collectResourceTiming).toBeTruthy();
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
            // eslint-disable-next-line @typescript-eslint/require-await
            async send(message) {
                expect(message).toEqual('geojson.loadData');
            }
        });

        new GeoJSONSource('id', {data: {}}, mockDispatcher).setData({});
    });

    test('coalesces updateData calls', async () => {
        let count = 0;

        return new Promise((resolve) => {
            const mockDispatcher = wrapDispatcher({
                send(message, args) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    const ids = JSON.parse(args.data).features.map(f => f.id);
                    if (count++ === 0) {
                        expect(ids).to.deep.equal([1]);
                    } else {
                        expect(ids).to.deep.equal([2, 3]);
                        resolve();
                    }
                    return new Promise(r => { setTimeout(r, 0); });
                }
            });

            const source = new GeoJSONSource('id', {dynamic: true, data: {}}, mockDispatcher);

            source.updateData({type: 'Feature', id: 1});
            source.updateData({type: 'Feature', id: 2});
            source.updateData({type: 'Feature', id: 3});
        });
    });

    test('forwards geojson-vt options with worker request', () => {
        const mockDispatcher = wrapDispatcher({
            // eslint-disable-next-line @typescript-eslint/require-await
            async send(message, params) {
                expect(message).toEqual('geojson.loadData');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/require-await
            async send(message, params) {
                expect(message).toEqual('geojson.loadData');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
            async send() {}
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
            // eslint-disable-next-line @typescript-eslint/require-await
            async send() { throw new Error('error'); }
        });

        const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);

        source.onAdd({
            getScaleFactor() {
                return 1;
            },
            getWorldview: () => undefined,
            getIndoorTileOptions: (source, scope) => null
        });

        await new Promise(resolve => {

            source.on('error', (err) => {
                expect(err.error.message).toEqual('error');
                resolve();
            });

            source.setData({});
        });
    });

    test('sends loadData request to dispatcher after data update', async () => {
        let expectedLoadDataCalls = 2;

        await new Promise(resolve => {
            const mockDispatcher = wrapDispatcher({
                // eslint-disable-next-line @typescript-eslint/require-await
                async send(message) {
                    if (message === 'geojson.loadData' && --expectedLoadDataCalls <= 0) {
                        resolve();
                    }
                }
            });

            const source = new GeoJSONSource('id', {data: {}}, mockDispatcher);
            source.onAdd({
                transform: {},
                getScaleFactor() {
                    return 1;
                },
                getWorldview: () => undefined,
                getIndoorTileOptions: (source, scope) => null
            });

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

describe('GeoJSONSource#loadTile', () => {
    // Tile requests resolve only when the test says so, and reject on abort like the real Actor.
    function createSource() {
        const responses: Array<(data?: object) => void> = [];
        const dispatcher = wrapDispatcher({
            send(type: string, data: unknown, {signal}: {signal: AbortSignal}) {
                return new Promise<object | undefined>((resolve, reject) => {
                    signal.addEventListener('abort', () => reject(signal.reason as Error), {once: true});
                    responses.push(resolve);
                });
            },
            sendCancelable: Actor.prototype.sendCancelable
        });
        const source = new GeoJSONSource('id', {data: {}}, dispatcher);
        source.map = {
            getScaleFactor: () => 1,
            getWorldview: () => undefined,
            getIndoorTileOptions: () => null
        };
        return {source, responses};
    }

    test('drops a superseded response that arrives after a full reload', async () => {
        const {source, responses} = createSource();
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const loaded = [];

        source.loadTile(tile, () => loaded.push('first'));
        source.loadTile(tile, () => loaded.push('second'));

        responses[1]();
        responses[0]();
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(loaded).toEqual(['second']);
    });

    test('applies an earlier response that arrives before a newer full reload completes', async () => {
        const {source, responses} = createSource();
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const loaded = [];

        source.loadTile(tile, () => loaded.push('first'));
        source.loadTile(tile, () => loaded.push('second'));

        responses[0]();
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(loaded).toEqual(['first']);
    });

    test('keeps an in-flight response when a partial reload is requested', async () => {
        const {source, responses} = createSource();
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const loaded = [];

        source.loadTile(tile, () => loaded.push('first'));
        source._partialReload = true;
        source.loadTile(tile, () => loaded.push('partial'));

        responses[1]();
        responses[0]();
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(loaded).toEqual(['partial', 'first']);
    });

    test('drops a superseded response that arrives after a partial reload with data', async () => {
        const {source, responses} = createSource();
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const loaded = [];

        source.loadTile(tile, () => loaded.push('first'));
        source._partialReload = true;
        source.loadTile(tile, () => loaded.push('partial'));

        responses[1]({});
        responses[0]({});
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(loaded).toEqual(['partial']);
    });
});

describe('GeoJSONSource queued updates', () => {
    const point = (id: number) => ({type: 'Feature', id, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}});
    const collection = (...ids: number[]) => ({type: 'FeatureCollection', features: ids.map(point)});

    // Records every loadData sent to the worker; each one takes a task to finish, like a real worker.
    function createSource() {
        const sent: Array<{append: boolean; ids: Array<number | string>}> = [];
        const dispatcher = wrapDispatcher({
            send(type: string, params: {append: boolean; data: string}) {
                const data = JSON.parse(params.data) as GeoJSON.FeatureCollection;
                sent.push({append: params.append, ids: data.features.map(f => f.id)});
                return new Promise((resolve) => { setTimeout(resolve, 0); });
            }
        });
        const source = new GeoJSONSource('id', {dynamic: true, data: {}}, dispatcher);
        const settled = () => new Promise((resolve) => { setTimeout(resolve, 20); });
        return {source, sent, settled};
    }

    test('sends an updateData queued behind setData as an update', async () => {
        const {source, sent, settled} = createSource();

        source.setData(collection(1, 2));
        source.updateData(point(3));
        await settled();

        expect(sent).toEqual([{append: false, ids: [1, 2]}, {append: true, ids: [3]}]);
    });

    test('sends a setData queued behind updateData as a replacement', async () => {
        const {source, sent, settled} = createSource();

        source.updateData(point(1));
        source.setData(collection(2));
        await settled();

        expect(sent).toEqual([{append: true, ids: [1]}, {append: false, ids: [2]}]);
    });

    test('sends an updateData queued behind a queued setData after it, unmerged', async () => {
        const {source, sent, settled} = createSource();

        source.setData(collection(1));
        source.setData(collection(2, 3));
        source.updateData(point(3));
        await settled();

        expect(sent).toEqual([{append: false, ids: [1]}, {append: false, ids: [2, 3]}, {append: true, ids: [3]}]);
    });

    test('queues an update made from a "data" listener behind updates already waiting', async () => {
        const {source, sent, settled} = createSource();

        source.setData(collection(1));
        source.setData(collection(2));
        source.once('data', () => source.updateData(point(3)));
        await settled();

        expect(sent).toEqual([{append: false, ids: [1]}, {append: false, ids: [2]}, {append: true, ids: [3]}]);
    });

    test('keeps queued updates when the source is reloaded during a load', async () => {
        const {source, sent, settled} = createSource();
        source.map = {style: {clearSource() {}}};

        source.setData(collection(1));
        source.setData(collection(2));
        source.updateData(point(3));
        source.reload();
        await settled();

        expect(sent).toEqual([{append: false, ids: [1]}, {append: false, ids: [2]}, {append: true, ids: [3]}]);
    });

    test('does not modify the data passed to updateData when merging queued updates', async () => {
        const {source, settled} = createSource();
        const first = collection(2);

        source.setData(collection(1));
        source.updateData(first);
        source.updateData(point(3));
        await settled();

        expect(first.features.map(f => f.id)).toEqual([2]);
    });
});

describe('GeoJSONSource#serialize', () => {
    const mapStub = {
        _requestManager: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            transformRequest: (url) => { return {url}; }
        },
        getWorldview: () => undefined,
        getIndoorTileOptions: () => null
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
