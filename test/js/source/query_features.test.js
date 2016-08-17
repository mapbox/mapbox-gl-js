'use strict';

var test = require('tap').test;
var QueryFeatures = require('../../../js/source/query_features.js');
var SourceCache = require('../../../js/source/source_cache.js');

test('QueryFeatures#rendered', function (t) {
    t.test('returns empty object if source returns no tiles', function (t) {
        var mockSourceCache = { tilesIn: function () { return []; } };
        var result = QueryFeatures.rendered(mockSourceCache);
        t.deepEqual(result, []);
        t.end();
    });

    t.end();
});

test('QueryFeatures#source', function (t) {
    t.test('returns empty result when source has no features', function (t) {
        var sourceCache = new SourceCache('test', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        }, {
            send: function (type, params, callback) { return callback(); }
        });
        var result = QueryFeatures.source(sourceCache, {});
        t.deepEqual(result, []);
        t.end();
    });

    t.end();
});
