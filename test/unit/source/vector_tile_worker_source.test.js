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
        }, (err, res) => {
            t.false(err);
            t.false(res);
        });

        t.deepEqual(source.loaded, { source: {} });
        t.end();
    });

    t.end();
});
