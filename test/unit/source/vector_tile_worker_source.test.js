'use strict';

import fs from 'fs';
import path from 'path';
import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import { test } from 'mapbox-gl-js-test';
import VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import perf from '../../../src/util/performance';

test('abortTile', (t) => {
    t.test('aborts pending request', (t) => {
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

    t.end();
});

test('removeTile', (t) => {
    t.test('removes loaded tile', (t) => {
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

    t.end();
});

test('loadTile', (t) => {
    t.test('resourceTiming', (t) => {
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

    t.end();
});
