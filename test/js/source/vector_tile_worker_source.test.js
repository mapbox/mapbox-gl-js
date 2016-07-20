'use strict';

var test = require('tap').test;
var VectorTileWorkerSource = require('../../../js/source/vector_tile_worker_source');

var styleLayers = {
    getLayers: function () {},
    getLayerFamilies: function () {}
};

test('VectorWorkerTile#abortTile', function(t) {
    t.test('aborts pending request', function(t) {
        var vectorWorkerSource = new VectorTileWorkerSource(null, styleLayers);

        vectorWorkerSource.loadTile({
            source: 'source',
            uid: 0,
            url: 'http://localhost:2900/abort'
        }, t.fail);

        vectorWorkerSource.abortTile({
            source: 'source',
            uid: 0
        });

        t.deepEqual(vectorWorkerSource.loading, { source: {} });
        t.end();
    });

    t.end();
});

test('remove tile', function(t) {
    t.test('removes loaded tile', function(t) {
        var vectorWorkerSource = new VectorTileWorkerSource(null, styleLayers);

        vectorWorkerSource.loaded = {
            source: {
                '0': {}
            }
        };

        vectorWorkerSource.removeTile({
            source: 'source',
            uid: 0
        });

        t.deepEqual(vectorWorkerSource.loaded, { source: {} });
        t.end();
    });

    t.end();
});

