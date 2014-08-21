'use strict';

var test = require('tape').test,
    Wrapper = require('../../../js/source/geojsonwrapper');

test('geojsonwrapper', function(t) {

    t.test('linestring', function(t) {
        var features = [{
            type: 'LineString',
            coords: [[{ x: 0, y: 0 }, {x:10, y:10}]],
            properties: { hello: 'world' }
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
            type: 'Point',
            coords: [[{x: 0, y: 1}]],
            properties: {}
        }];

        var wrap = new Wrapper(features);
        var feature = wrap.feature(0);
        t.deepEqual(feature.bbox(), [0, 1, 0, 1], 'bbox');
        t.end();
    });
});
