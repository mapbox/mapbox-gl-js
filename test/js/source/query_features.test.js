'use strict';

var test = require('tap').test;
var QueryFeatures = require('../../../js/source/query_features.js');

test('QueryFeatures#rendered', function (t) {
    t.test('returns empty object if source returns no tiles', function (t) {
        var mockSourceCache = { tilesIn: function () { return []; } };
        var result = QueryFeatures.rendered(mockSourceCache);
        t.deepEqual(result, {});
        t.end();
    });

    t.end();
});
