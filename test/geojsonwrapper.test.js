'use strict';

var test = require('tape').test,
    WorkerTile = require('../js/worker/workertile'),
    Wrapper = require('../js/worker/geojsonwrapper');

// Stub for code coverage

test('geojsonwrapper', function(t) {
    var features = [{
        type: 'LineString',
        coords: [[{ x: 0, y: 0 }, {x:10, y:10}]],
        properties: {}
    }];
    var wrap = new Wrapper(features);
    var feature = wrap.feature(0);
    t.ok(feature, 'gets a feature');
    t.deepEqual(feature.bbox(), [0, 0, 10, 10], 'bbox');
    t.end();
});
