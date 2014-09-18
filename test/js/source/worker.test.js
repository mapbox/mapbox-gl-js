'use strict';

var test = require('tape').test;
var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');

// Stub for code coverage

test('basic', function(t) {
    WorkerTile.buckets = [{
        id: 'test',
        source: 'source',
        type: 'fill',
        compare: function () { return true; }
    }];

    var features = [{
        type: 'Point',
        coords: [0, 0],
        properties: {}
    }];

    new WorkerTile(null, new Wrapper(features), '', 0, 20, 512, 'source', 1, {}, function(err, result) {
        t.ok(result.buffers, 'buffers');
        t.ok(result.elementGroups, 'element groups');
        t.end();
    });
});
