'use strict';

var test = require('tape');

require('../../bootstrap');

var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');

test('basic', function(t) {
    var buckets = [{
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

    var tile = new WorkerTile('', 0, 20, 512, 'source', 1);
    tile.parse(new Wrapper(features), buckets, {}, function(err, result) {
        t.ok(result.buffers, 'buffers');
        t.ok(result.elementGroups, 'element groups');
        t.end();
    });
});
