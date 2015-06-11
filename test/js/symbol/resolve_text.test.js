'use strict';

var test = require('prova');
var resolveText = require('../../../js/symbol/resolve_text');

function mockFeature(obj) {
    var f = {};
    f.loadGeometry = function() { return {}; };
    f.properties = obj;
    return f;
}

test('resolveText', function(t) {
    // Latin ranges.
    // Skips feature without text field.
    var layout = { 'text-field': '{name}', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            'Pennsylvania Ave NW DC',
            'Baker St',
            null,
            '14 St NW'
        ],
        codepoints: { 'Test': [ 32, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 101, 105, 107, 108, 110, 114, 115, 116, 118, 121 ] }
    }, resolveText([
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], [layout, layout, layout, layout], {}));

    // Token replacement.
    layout = { 'text-field': '{name}-suffixed', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            'Pennsylvania Ave NW DC-suffixed',
            'Baker St-suffixed',
            '-suffixed',
            '14 St NW-suffixed'
        ],
        codepoints: { 'Test': [ 32, 45, 49, 52, 65, 66, 67, 68, 78, 80, 83, 87, 97, 100, 101, 102, 105, 107, 108, 110, 114, 115, 116, 117, 118, 120, 121 ] }
    }, resolveText([
        mockFeature({ 'name': 'Pennsylvania Ave NW DC' }),
        mockFeature({ 'name': 'Baker St' }),
        mockFeature({}),
        mockFeature({ 'name': '14 St NW' })
    ], [layout, layout, layout, layout], {}));

    // Non-latin ranges.
    layout = { 'text-field': '{city}', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            '서울특별시'
        ],
        codepoints: { 'Test': [ 48324, 49436, 49884, 50872, 53945 ] }
    }, resolveText([
        mockFeature({ 'city': '서울특별시' })
    ], [layout], {}));

    // Includes unicode up to 65535.
    layout = { 'text-field': '{text}', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            '\ufff0',
            '\uffff'
        ],
        codepoints: { 'Test': [ 65520, 65535 ] }
    }, resolveText([
        mockFeature({ 'text': '\ufff0' }),
        mockFeature({ 'text': '\uffff' })
    ], [layout, layout], {}));

    // Non-string values cast to strings.
    layout = { 'text-field': '{name}', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            '5000',
            '-15.5',
            'true'
        ],
        codepoints: { 'Test': [ 45, 46, 48, 49, 53, 101, 114, 116, 117 ] }
    }, resolveText([
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], [layout, layout, layout], {}));

    // Non-string values cast to strings, with token replacement.
    layout = { 'text-field': '{name}-suffix', 'text-font': 'Test' };
    t.deepEqual({
        textFeatures: [
            '5000-suffix',
            '-15.5-suffix',
            'true-suffix'
        ],
        codepoints: { 'Test': [ 45, 46, 48, 49, 53, 101, 102, 105, 114, 115, 116, 117, 120 ] }
    }, resolveText([
        mockFeature({ 'name': 5000 }),
        mockFeature({ 'name': -15.5 }),
        mockFeature({ 'name': true })
    ], [layout, layout, layout], {}));


    t.end();
});
