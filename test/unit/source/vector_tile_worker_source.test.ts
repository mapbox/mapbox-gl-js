// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import perf from '../../../src/util/performance';
import {getProjection} from '../../../src/geo/projection/index';
import {getPNGResponse} from '../../util/network';
import rawTileDataImport from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

import type {LoadVectorDataCallback} from '../../../src/source/load_vector_tile';

const rawTileData = rawTileDataImport as ArrayBuffer;
const actor = {async send() {}};

// eslint-disable-next-line @typescript-eslint/require-await
test('VectorTileWorkerSource#abortTile aborts pending request', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});

    const loadPromise = source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://localhost:2900/abort'}
    });
    loadPromise.catch(() => {}); // suppress abort rejection

    source.abortTile({source: 'source', uid: 0});
    expect(source.loading).toEqual({});
});

test('VectorTileWorkerSource#abortTile aborts pending async request', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});
    source.loadVectorData = (params, cb) => {
        setTimeout(() => { cb(null, {}); }, 0);
    };

    const loadPromise = source.loadTile({
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'})
    });
    source.abortTile({uid: 0});

    const result = await loadPromise;
    expect(result).toBeNull();
});

// eslint-disable-next-line @typescript-eslint/require-await
test('VectorTileWorkerSource#removeTile removes loaded tile', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});

    source.loaded = {'0': {}};

    source.removeTile({source: 'source', uid: 0});
    expect(source.loaded).toEqual({});
});

test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse,
            updateParameters: () => {}
        }
    };

    const reloadPromise = source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[0][5](); // calls done → resolves reloadPromise
    await reloadPromise;
});

test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse,
            updateParameters: () => {}
        }
    };

    const promise1 = source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    const promise2 = source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[0][5](); // done1: triggers 2nd parse, resolves promise1
    expect(parse).toHaveBeenCalledTimes(2);
    await promise1;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[1][5](); // done2: resolves promise2
    await promise2;
});

test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', async () => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6308
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse,
            updateParameters: () => {}
        }
    };

    // First reload: status=done → parse triggered immediately
    const promise1 = source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    // Second reload: queues via reloadCallback
    const promise2 = source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[0][5](); // done1: triggers 2nd parse, resolves promise1
    expect(parse).toHaveBeenCalledTimes(2);
    await promise1;

    // Third reload overwrites reloadCallback while 2nd parse is in progress
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).toHaveBeenCalledTimes(2);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[1][5](); // done2: triggers 3rd parse (with done3), resolves promise2
    expect(parse).toHaveBeenCalledTimes(3);
    await promise2;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    parse.mock.calls[2][5](); // done3: resolves promise3 (not captured)
    expect(parse).toHaveBeenCalledTimes(3);
});

test('VectorTileWorkerSource#reloadTile does not reparse tiles with no vectorTile data but does call callback', async () => {
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true});
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            parse,
            updateParameters: () => {}
        }
    };

    await source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}});
    expect(parse).not.toHaveBeenCalled();
});

test('VectorTileWorkerSource#loadTile forwards response headers', async () => {
    const headers = new Headers();
    headers.set('Cache-Control', 'max-age=30');
    headers.set('Expires', 'Thu, 01 Jan 2099 00:00:00 GMT');

    function loadVectorData(params, callback: LoadVectorDataCallback) {
        return callback(null, {
            vectorTile: new VectorTile(new PbfReader(rawTileData)),
            rawData: rawTileData,
            headers
        });
    }

    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const source = new VectorTileWorkerSource({actor, layerIndex, availableImages: [], availableModels: [], isSpriteLoaded: true});
    source.loadVectorData = loadVectorData;

    const res = await source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://localhost:2900/faketile.pbf'}
    });
    expect(res.headers.get('cache-control')).toBe('max-age=30');
    expect(res.headers.get('expires')).toBe('Thu, 01 Jan 2099 00:00:00 GMT');
});

test('VectorTileWorkerSource rejects ImageBitmap from provider with an error', async () => {
    const pngBlob = await getPNGResponse();
    const realBitmap = await createImageBitmap(pngBlob);

    const tileProvider = {loadTile: vi.fn().mockResolvedValue({data: realBitmap})};
    const source = new VectorTileWorkerSource({actor, layerIndex: new StyleLayerIndex(), availableImages: [], availableModels: [], isSpriteLoaded: true, tileProvider});

    const loadPromise = source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://example.com/0/0/0.pbf'}
    });
    await expect(loadPromise).rejects.toThrow('Vector tiles require ArrayBuffer data');
});

test('VectorTileWorkerSource provides resource timing information', async () => {
    function loadVectorData(params, callback: LoadVectorDataCallback) {
        return callback(null, {
            vectorTile: new VectorTile(new PbfReader(rawTileData)),
            rawData: rawTileData,
            cacheControl: null,
            expires: null
        });
    }

    const exampleResourceTiming = {
        connectEnd: 473,
        connectStart: 473,
        decodedBodySize: 86494,
        domainLookupEnd: 473,
        domainLookupStart: 473,
        duration: 341,
        encodedBodySize: 52528,
        entryType: "resource",
        fetchStart: 473.5,
        initiatorType: "xmlhttprequest",
        name: "http://localhost:2900/faketile.pbf",
        nextHopProtocol: "http/1.1",
        redirectEnd: 0,
        redirectStart: 0,
        requestStart: 477,
        responseEnd: 815,
        responseStart: 672,
        secureConnectionStart: 0
    };

    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const source = new VectorTileWorkerSource({actor, layerIndex, availableImages: [], availableModels: [], isSpriteLoaded: true});
    source.loadVectorData = loadVectorData;

    vi.spyOn(perf, 'getEntriesByName').mockImplementation(() => { return [exampleResourceTiming]; });

    const res = await source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
    });
    expect(res.resourceTiming[0]).toStrictEqual(exampleResourceTiming);
});
