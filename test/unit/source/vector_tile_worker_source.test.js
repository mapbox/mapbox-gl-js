'use strict';

const test = require('mapbox-gl-js-test').test;
const VectorTileWorkerSource = require('../../../src/source/vector_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

test('abortTile', (t) => {
    t.test('aborts pending request', (t) => {
        const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

        source.loadTile({
            source: 'source',
            uid: 0,
            request: { url: 'http://localhost:2900/abort' }
        }, t.fail);

        source.abortTile({
            source: 'source',
            uid: 0
        });

        t.deepEqual(source.loading, { source: {} });
        t.end();
    });

    t.end();
});

test('removeTile', (t) => {
    t.test('removes loaded tile', (t) => {
        const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

        source.loaded = {
            source: {
                '0': {}
            }
        };

        source.removeTile({
            source: 'source',
            uid: 0
        });

        t.deepEqual(source.loaded, { source: {} });
        t.end();
    });

    t.end();
});

test('redoPlacement', (t) => {

    t.test('on loaded tile', (t) => {
        const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
        const tile = {
            redoPlacement: function(angle, pitch, cameraToCenterDistance, cameraToTileDistance, showCollisionBoxes) {
                t.equal(angle, 60);
                t.equal(pitch, 30);
                t.equal(showCollisionBoxes, false);
                return {
                    result: {isResult: true},
                    transferables: {isTransferrables: true}
                };
            }
        };
        source.loaded = {mapbox: {3: tile}};

        source.redoPlacement({
            uid: 3,
            source: 'mapbox',
            angle: 60,
            pitch: 30,
            cameraToCenterDistance: 1,
            cameraToTileDistance: 1,
            showCollisionBoxes: false
        }, (err, result, transferables) => {
            t.error(err);
            t.ok(result.isResult);
            t.ok(transferables.isTransferrables);
            t.end();
        });
    });

    t.test('on loading tile', (t) => {
        const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
        const tile = {};
        source.loading = {mapbox: {3: tile}};

        source.redoPlacement({
            uid: 3,
            source: 'mapbox',
            angle: 60
        });

        t.equal(source.loading.mapbox[3].angle, 60);
        t.end();
    });

    t.end();
});
