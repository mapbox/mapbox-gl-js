import fs from 'fs';
import path from 'path';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import { test } from 'mapbox-gl-js-test';
import VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import perf from '../../../src/util/performance';

test('VectorTileWorkerSource#abortTile aborts pending request', (t) => {
    const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: { overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0} },
        request: { url: 'http://localhost:2900/abort' }
    }, (err, res) => {
        t.false(err);
        t.false(res);
    });

    source.abortTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        t.false(err);
        t.false(res);
    });

    t.deepEqual(source.loading, {});
    t.end();
});

test('VectorTileWorkerSource#removeTile removes loaded tile', (t) => {
    const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

    source.loaded = {
        '0': {}
    };

    source.removeTile({
        source: 'source',
        uid: 0
    }, (err, res) => {
        t.false(err);
        t.false(res);
    });

    t.deepEqual(source.loaded, {});
    t.end();
});

test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', (t) => {
    const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
    const parse = t.spy();

    source.loaded = {
        '0': {
            status: 'done',
            parse
        }
    };

    const callback = t.spy();
    source.reloadTile({ uid: 0 }, callback);
    t.equal(parse.callCount, 1);

    parse.firstCall.args[3]();
    t.equal(callback.callCount, 1);

    t.end();
});

test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', (t) => {
    const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
    const parse = t.spy();

    source.loaded = {
        '0': {
            status: 'done',
            parse
        }
    };

    const callback1 = t.spy();
    const callback2 = t.spy();
    source.reloadTile({ uid: 0 }, callback1);
    t.equal(parse.callCount, 1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({ uid: 0 }, callback2);
    t.equal(parse.callCount, 1);

    parse.firstCall.args[3]();
    t.equal(parse.callCount, 2);
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 0);

    parse.secondCall.args[3]();
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 1);

    t.end();
});

test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6308
    const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
    const parse = t.spy();

    source.loaded = {
        '0': {
            status: 'done',
            parse
        }
    };

    const callback1 = t.spy();
    const callback2 = t.spy();
    const callback3 = t.spy();
    source.reloadTile({ uid: 0 }, callback1);
    t.equal(parse.callCount, 1);

    source.loaded[0].status = 'parsing';
    source.reloadTile({ uid: 0 }, callback2);
    t.equal(parse.callCount, 1);

    parse.firstCall.args[3]();
    t.equal(parse.callCount, 2);
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 0);
    t.equal(callback3.callCount, 0);

    source.reloadTile({ uid: 0 }, callback3);
    t.equal(parse.callCount, 2);
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 0);
    t.equal(callback3.callCount, 0);

    parse.secondCall.args[3]();
    t.equal(parse.callCount, 3);
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 1);
    t.equal(callback3.callCount, 0);

    parse.thirdCall.args[3]();
    t.equal(callback1.callCount, 1);
    t.equal(callback2.callCount, 1);
    t.equal(callback3.callCount, 1);

    t.end();
});

test('VectorTileWorkerSource provides resource timing information', (t) => {
    const rawTileData = fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));

    function loadVectorData(params, callback) {
        return callback(null, {
            vectorTile: new vt.VectorTile(new Protobuf(rawTileData)),
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

    const source = new VectorTileWorkerSource(null, layerIndex, loadVectorData);

    t.stub(perf, 'getEntriesByName').callsFake(() => { return [ exampleResourceTiming ]; });

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: { overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0} },
        request: { url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true }
    }, (err, res) => {
        t.false(err);
        t.deepEquals(res.resourceTiming[0], exampleResourceTiming, 'resourceTiming resp is expected');
        t.end();
    });
});

test('VectorTileWorkerSource provides resource timing information (fallback method)', (t) => {
    const rawTileData = fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));

    function loadVectorData(params, callback) {
        return callback(null, {
            vectorTile: new vt.VectorTile(new Protobuf(rawTileData)),
            rawData: rawTileData,
            cacheControl: null,
            expires: null
        });
    }

    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const source = new VectorTileWorkerSource(null, layerIndex, loadVectorData);

    const sampleMarks = [100, 350];
    const marks = {};
    const measures = {};
    t.stub(perf, 'getEntriesByName').callsFake((name) => { return measures[name] || []; });
    t.stub(perf, 'mark').callsFake((name) => {
        marks[name] = sampleMarks.shift();
        return null;
    });
    t.stub(perf, 'measure').callsFake((name, start, end) => {
        measures[name] = measures[name] || [];
        measures[name].push({
            duration: marks[end] - marks[start],
            entryType: 'measure',
            name: name,
            startTime: marks[start]
        });
        return null;
    });
    t.stub(perf, 'clearMarks').callsFake(() => { return null; });
    t.stub(perf, 'clearMeasures').callsFake(() => { return null; });

    source.loadTile({
        source: 'source',
        uid: 0,
        tileID: { overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0} },
        request: { url: 'http://localhost:2900/faketile.pbf', collectResourceTiming: true }
    }, (err, res) => {
        t.false(err);
        t.deepEquals(res.resourceTiming[0], {"duration": 250, "entryType": "measure", "name": "http://localhost:2900/faketile.pbf", "startTime": 100 }, 'resourceTiming resp is expected');
        t.end();
    });
});
