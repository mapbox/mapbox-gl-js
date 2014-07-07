'use strict';

var test = require('tape').test,
    WorkerTile = require('../js/worker/workertile'),
    Wrapper = require('../js/worker/geojsonwrapper');

// Stub for code coverage

test('basic', function(t) {
    WorkerTile.buckets = [{
        id: 'test',
        source: 'source',
        render: {
            type: 'icon'
        },
        compare: function () { return true; }
    }];

    var features = [{
        type: 'Point',
        coords: [0, 0],
        properties: {}
    }];

    var tile = new WorkerTile(null, new Wrapper(features), '', 0, 512, 'source', function() {
        t.ok(tile.buffers, 'buffers');
        t.end();
    });
});
