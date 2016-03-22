'use strict';

var test = require('tap').test;
var resolveText = require('../../../js/symbol/resolve_text');

function mockFeature(obj) {
    var f = {};
    f.loadGeometry = function() { return {}; };
    f.properties = obj;
    return f;
}

function compareResolve(t, expected, features, props) {
    var stack = {};
    t.deepEqual(resolveText(features, props, stack), expected.textFeatures);
    t.deepEqual(Object.keys(stack).map(Number).sort(compareNum), expected.codepoints);
}

function compareNum(a, b) {
    return a - b;
}

test('resolveText', function(t) {
    // Latin ranges.
    // Skips feature without text field.
    compareResolve(t, {
        textFeatures: [
            'Pennsylvania Ave NW DC',
            'Baker St',
            null,
            '14 St NW'
        ],
        codepoints: [ 32, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 101, 105, 107, 108, 110, 114, 115, 116, 118, 121 ]
    }, [
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], {
        'text-field': '{name}'
    });

    // Token replacement.
    compareResolve(t, {
        textFeatures: [
            'Pennsylvania Ave NW DC-suffixed',
            'Baker St-suffixed',
            '-suffixed',
            '14 St NW-suffixed'
        ],
        codepoints: [ 32, 45, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 100, 101, 102, 105, 107, 108, 110, 114, 115, 116, 117, 118, 120, 121 ]
    }, [
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], {
        'text-field': '{name}-suffixed'
    });

    // Non-latin ranges.
    compareResolve(t, {
        textFeatures: [
            '서울특별시'
        ],
        codepoints: [ 48324, 49436, 49884, 50872, 53945 ]
    }, [
        mockFeature({ 'city': '서울특별시' })
    ], {
        'text-field': '{city}'
    });

    // Includes unicode up to 65535.
    compareResolve(t, {
        textFeatures: [
            '\ufff0',
            '\uffff'
        ],
        codepoints: [ 65520, 65535 ]
    }, [
        mockFeature({ 'text': '\ufff0' }),
        mockFeature({ 'text': '\uffff' })
    ], {
        'text-field': '{text}'
    });

    // Non-string values cast to strings.
    compareResolve(t, {
        textFeatures: [
            '5000',
            '-15.5',
            'true'
        ],
        codepoints: [ 45, 46, 48, 49, 53, 101, 114, 116, 117 ]
    }, [
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], {
        'text-field': '{name}'
    });

    // Non-string values cast to strings, with token replacement.
    compareResolve(t, {
        textFeatures: [
            '5000-suffix',
            '-15.5-suffix',
            'true-suffix'
        ],
        codepoints: [ 45, 46, 48, 49, 53, 101, 102, 105, 114, 115, 116, 117, 120 ]
    }, [
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], {
        'text-field': '{name}-suffix'
    });

    t.end();
});
