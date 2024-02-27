import {test, expect, vi} from "../../util/vitest.js";
import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import perf from '../../../src/util/performance.js';
import {getProjection} from '../../../src/geo/projection/index.js';
// eslint-disable-next-line import/no-unresolved
import rawTileData from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

const actor = {send: () => {}};

test('VectorTileWorkerSource#abortTile aborts pending request', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);

    expect.assertions(3);

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://localhost:2900/abort'}
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    source.abortTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    expect(source.loading).toEqual({});
});

test('VectorTileWorkerSource#abortTile aborts pending async request', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true, (params, cb) => {
        setTimeout(() => {
            cb(null, {});
        }, 0);
    });

    source.loadTile({
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'})
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });
    source.abortTile({uid: 0}, () => {});
});

test('VectorTileWorkerSource#removeTile removes loaded tile', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);

    expect.assertions(3);

    source.loaded = {
        '0': {}
    };

    source.removeTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBeFalsy();
    });

    expect(source.loaded).toEqual({});
});

test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback = vi.fn();
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mock.calls[0][4]();
    expect(callback).toHaveBeenCalledTimes(1);
});

test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback1);
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback2);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mock.calls[0][4]();
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    parse.mock.calls[1][4]();
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
});

test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', () => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6308
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            vectorTile: {},
            parse
        }
    };

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback1);
    expect(parse).toHaveBeenCalledTimes(1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback2);
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mock.calls[0][4]();
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();

    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback3);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();

    parse.mock.calls[1][4]();
    expect(parse).toHaveBeenCalledTimes(3);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).not.toHaveBeenCalled();

    parse.mock.calls[2][4]();
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
});

test('VectorTileWorkerSource#reloadTile does not reparse tiles with no vectorTile data but does call callback', () => {
    const source = new VectorTileWorkerSource(actor, new StyleLayerIndex(), [], true);
    const parse = vi.fn();

    source.loaded = {
        '0': {
            status: 'done',
            parse
        }
    };

    const callback = vi.fn();

    source.reloadTile({uid: 0, tileID: {canonical: {x: 0, y: 0, z: 0}}, projection: {name: 'mercator'}}, callback);
    expect(parse).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
});

test('VectorTileWorkerSource provides resource timing information', () => {
    function loadVectorData(params, callback) {
        return callback(null, {
            vectorTile: new VectorTile(new Protobuf(rawTileData)),
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

    const source = new VectorTileWorkerSource(actor, layerIndex, [], true, loadVectorData);

    vi.spyOn(perf, 'getEntriesByName').mockImplementation(() => { return [ exampleResourceTiming ]; });

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
        projection: getProjection({name: 'mercator'}),
        request: {url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true}
    }, (err, res) => {
        expect(err).toBeFalsy();
        expect(res.resourceTiming[0]).toStrictEqual(exampleResourceTiming);
    });
});
