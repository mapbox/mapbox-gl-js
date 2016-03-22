'use strict';

var test = require('tap').test;
var Wrapper = require('../../../js/source/geojson_wrapper');

test('geojsonwrapper', function(t) {

    t.test('linestring', function(t) {
        var features = [{
            type: 2,
            geometry: [[[0, 0], [10, 10]]],
            tags: { hello: 'world' }
        }];

        var wrap = new Wrapper(features);
        var feature = wrap.feature(0);

        t.ok(feature, 'gets a feature');
        t.deepEqual(feature.bbox(), [0, 0, 10, 10], 'bbox');
        t.equal(feature.type, 2, 'type');
        t.deepEqual(feature.properties, {hello:'world'}, 'properties');

        t.end();
    });

    t.test('point', function(t) {
        var features = [{
            type: 1,
            geometry: [[0, 1]],
            tags: {}
        }];

        var wrap = new Wrapper(features);
        var feature = wrap.feature(0);
        t.deepEqual(feature.bbox(), [0, 1, 0, 1], 'bbox');
        t.end();
    });

    t.end();
});
