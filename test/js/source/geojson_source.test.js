'use strict';

var test = require('tape');

require('../../bootstrap');

var GeoJSONSource = require('../../../js/source/geojson_source');

test('GeoJSONSource#setData', function(t) {
    t.test('returns self', function(t) {
        var source = new GeoJSONSource({data: {}});
        t.equal(source.setData({}), source);
        t.end();
    });

    t.test('fires change', function(t) {
        var source = new GeoJSONSource({data: {}});
        source.on('change', function() {
            t.end();
        });
        source.setData({});
    });
});
