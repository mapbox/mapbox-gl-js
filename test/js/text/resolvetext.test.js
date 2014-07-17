'use strict';
var test = require('tape').test;
var resolveText = require('../../../js/text/resolvetext.js');

function mockFeature(obj) {
    var f = {};
    f.loadGeometry = function() { return {}; };
    f.properties = obj;
    return f;
}

test('resolveText', function(t) {
    // Latin ranges.
    // Skips feature without text field.
    t.deepEqual({
        textFeatures: [
            'Pennsylvania Ave NW DC',
            'Baker St',
            ,
            '14 St NW'
        ],
        codepoints: [ 32, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 101, 105, 107, 108, 110, 114, 115, 116, 118, 121 ]
    }, resolveText([
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], {
        'text-field': '{name}'
    }, {}));

    // Token replacement.
    t.deepEqual({
        textFeatures: [
            'Pennsylvania Ave NW DC-suffixed',
            'Baker St-suffixed',
            '-suffixed',
            '14 St NW-suffixed'
        ],
        codepoints: [ 32, 45, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 100, 101, 102, 105, 107, 108, 110, 114, 115, 116, 117, 118, 120, 121 ]
    }, resolveText([
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], {
        'text-field': '{name}-suffixed'
    }, {}));

    // Non-latin ranges.
    t.deepEqual({
        textFeatures: [
            '서울특별시',
        ],
        codepoints: [ 48324, 49436, 49884, 50872, 53945 ]
    }, resolveText([
        mockFeature({ 'city': '서울특별시' })
    ], {
        'text-field': '{city}'
    }, {}));

    // Excludes unicode beyond 65533.
    t.deepEqual({
        textFeatures: [
            '\ufff0'
        ],
        codepoints: [ 65520 ]
    }, resolveText([
        mockFeature({ 'text': '\ufff0' }), // included
        mockFeature({ 'text': '\uffff' })  // excluded
    ], {
        'text-field': '{text}'
    }, {}));

    // Non-string values cast to strings.
    t.deepEqual({
        textFeatures: [
            '5000',
            '-15.5',
            'true'
        ],
        codepoints: [ 45, 46, 48, 49, 53, 101, 114, 116, 117 ]
    }, resolveText([
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], {
        'text-field': '{name}'
    }, {}));

    // Non-string values cast to strings, with token replacement.
    t.deepEqual({
        textFeatures: [
            '5000-suffix',
            '-15.5-suffix',
            'true-suffix'
        ],
        codepoints: [ 45, 46, 48, 49, 53, 101, 102, 105, 114, 115, 116, 117, 120 ]
    }, resolveText([
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], {
        'text-field': '{name}-suffix'
    }, {}));


    t.end();
});
