'use strict';

var test = require('tape').test,
    Wrapper = require('../../../js/worker/geojsonwrapper');

test('geojsonwrapper', function(t) {

    var features = [{
        type: 'LineString',
        coords: [[{ x: 0, y: 0 }, {x:10, y:10}]],
        properties: { hello: 'world' }
    }];

    var wrap = new Wrapper(features);
    var feature = wrap.feature(0);

    t.ok(feature, 'gets a feature');
    t.deepEqual(feature.bbox(), [0, 0, 10, 10], 'bbox');
    t.equal(feature._type, 2, '_type');
    t.deepEqual(feature.properties, {hello:'world'}, 'properties');

    t.end();

});
