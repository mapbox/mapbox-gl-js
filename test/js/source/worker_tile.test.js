'use strict';

var test = require('prova');
var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');

test('basic', function(t) {
    var builders = [{
        id: 'test',
        source: 'source',
        type: 'fill',
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
        tile.parse(new Wrapper(features), builders, {}, function(err, result) {
            t.equal(err, null);
            t.ok(result.buffers, 'buffers');
            t.ok(result.elementGroups, 'element groups');
            t.end();
        });
    });

    t.test('hidden layers', function(t) {
        builders.push({
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: { visibility: 'none' },
            compare: function () { return true; }
        });
        tile.parse(new Wrapper(features), builders, {}, function(err, result) {
            t.equal(err, null);
            t.equal(Object.keys(result.elementGroups).length, 1, 'element groups exclude hidden layer');
            t.end();
        });
    });
});
