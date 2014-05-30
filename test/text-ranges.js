'use strict';
var test = require('tape').test;
var getRanges = require('../js/text/ranges.js');

test('getRanges', function(t) {
    // Latin ranges.
    // Skips feature without text field.
    t.deepEqual({
        ranges: ['0-255'],
        text_features: [ 0, 1, 3 ],
        codepoints: [ 32, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 101, 105, 107, 108, 110, 114, 115, 116, 118, 121 ]
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
        ranges: [ '48128-48383', '49408-49663', '49664-49919', '50688-50943', '53760-54015' ],
        text_features: [ 0 ],
        codepoints: [ 48324, 49436, 49884, 50872, 53945 ]
    }, getRanges([
        { 'city': '서울특별시' }
    ], {
        'text-field': 'city'
    }));

    t.end();
});
