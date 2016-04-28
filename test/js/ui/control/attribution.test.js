'use strict';

var test = require('tap').test;

var Attribution = require('../../../../js/ui/control/attribution');

test('Attribution', function (t) {
    t.test('dedupe attributions that are substrings of others', function (t) {
        var mockSources = {};
        [
            'World',
            'Hello World',
            'Another Source',
            'Hello',
            'Hello World'
        ].forEach(function (s, i) {
            mockSources['source-' + i] = { attribution: s };
        });

        var expected = 'Hello World | Another Source';
        var actual = Attribution.createAttributionString(mockSources);
        t.same(actual, expected, 'deduped attributions string');
        t.end();
    });

    t.end();
});

