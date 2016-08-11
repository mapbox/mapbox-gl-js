'use strict';

var test = require('tap').test;
var VectorTileWorkerSource = require('../../../js/source/vector_tile_worker_source');

var styleLayers = {
    getLayers: function () {},
    getLayerFamilies: function () {}
};

test('abortTile', function(t) {
    t.test('aborts pending request', function(t) {
        var source = new VectorTileWorkerSource(null, styleLayers);

        source.loadTile({
            source: 'source',
            uid: 0,
            url: 'http://localhost:2900/abort'
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

test('removeTile', function(t) {
    t.test('removes loaded tile', function(t) {
        var source = new VectorTileWorkerSource(null, styleLayers);

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

test('redoPlacement', function(t) {

    t.test('on loaded tile', function(t) {
        var source = new VectorTileWorkerSource(null, styleLayers);
        var tile = {
            redoPlacement: function(angle, pitch, showCollisionBoxes) {
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
            showCollisionBoxes: false
        }, function(err, result, transferables) {
            t.error(err);
            t.ok(result.isResult);
            t.ok(transferables.isTransferrables);
            t.end();
        });
    });

    t.test('on loading tile', function(t) {
        var source = new VectorTileWorkerSource(null, styleLayers);
        var tile = {};
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
