'use strict';

var test = require('tap').test;
var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');

test('basic', function(t) {
    var buckets = [{
        id: 'test',
        source: 'source',
        type: 'circle',
        layout: {},
        compare: function () { return true; }
    }];

    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }];

    var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
        coord: new TileCoord(1, 1, 1), overscaling: 1 });

    t.test('basic worker tile', function(t) {
        tile.parse(new Wrapper(features), buckets, {}, function(err, result) {
            t.equal(err, null);
            t.ok(result.buckets[0]);
            t.end();
        });
    });

    t.test('hidden layers', function(t) {
        buckets.push({
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: { visibility: 'none' },
            compare: function () { return true; }
        });
        tile.parse(new Wrapper(features), buckets, {}, null, function(err, result) {
            t.equal(err, null);
            t.equal(Object.keys(result.buckets[0].elementGroups).length, 1, 'element groups exclude hidden layer');
            t.end();
        });
    });

    t.end();
});
