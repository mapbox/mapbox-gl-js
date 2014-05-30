'use strict';
var test = require('tape').test;
var getRanges = require('../js/text/ranges.js');

test('getRanges', function(t) {
    // Latin ranges.
    // Skips feature without text field.
    t.deepEqual({
        ranges: ['0-255'],
        text_features: [ 0, 1, 3 ],
        codepoints: [ 80,101,110,115,121,108,118,97,105,32,65,78,87,68,67,66,107,114,83,116,49,52 ]
    }, getRanges([
        { 'name': 'Pennsylvania Ave NW DC' },
        { 'name': 'Baker St' },
        {},
        { 'name': '14 St NW' }
    ], {
        'text-field': 'name'
    }));

    // Non-latin ranges.
    t.deepEqual({
        ranges: [ '49408-49663', '50688-50943', '53760-54015', '48128-48383', '49664-49919' ],
        text_features: [ 0 ],
        codepoints: [ 49436, 50872, 53945, 48324, 49884 ]
    }, getRanges([
        { 'city': '서울특별시' }
    ], {
        'text-field': 'city'
    }));

    t.end();
});
