'use strict';

import { test } from 'mapbox-gl-js-test';
import WorkerTile from '../../../src/source/worker_tile';
import Wrapper from '../../../src/source/geojson_wrapper';
import { OverscaledTileID } from '../../../src/source/tile_id';
import StyleLayerIndex from '../../../src/style/style_layer_index';
import util from '../../../src/util/util';

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        tileID: new OverscaledTileID(1, 0, 1, 1, 1),
        overscaling: 1
    });
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]);
}

test('WorkerTile#parse', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        type: 'circle'
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, {}, (err, result) => {
        t.ifError(err);
        t.ok(result.buckets[0]);
        t.end();
    });
});

test('WorkerTile#parse skips hidden layers', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: { visibility: 'none' }
    }]);

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerIndex, {}, (err, result) => {
        t.ifError(err);
        t.equal(result.buckets.length, 0);
        t.end();
    });
});

test('WorkerTile#parse skips layers without a corresponding source layer', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
    }]);

    const tile = createWorkerTile();
    tile.parse({layers: {}}, layerIndex, {}, (err, result) => {
        t.ifError(err);
        t.equal(result.buckets.length, 0);
        t.end();
    });
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', (t) => {
    const layerIndex = new StyleLayerIndex([{
        id: 'test',
        source: 'source',
        'source-layer': 'test',
        type: 'fill'
    }]);

    const data = {
        layers: {
            test: {
                version: 1
            }
        }
    };

    t.stub(util, 'warnOnce');

    const tile = createWorkerTile();
    tile.parse(data, layerIndex, {}, (err) => {
        t.ifError(err);
        t.ok(util.warnOnce.calledWithMatch(/does not use vector tile spec v2/));
        t.end();
    });
});
