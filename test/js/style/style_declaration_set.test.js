'use strict';

var test = require('prova');
var StyleDeclarationSet = require('../../../js/style/style_declaration_set');

test('StyleDeclarationSet', function(t) {
    t.test('creates value setters', function(t) {
        var set = new StyleDeclarationSet('paint', 'background');
        set['background-color'] = 'blue';
        t.deepEqual(set._values['background-color'].value, [0, 0, 1, 1]);
        t.end();
    });

    t.test('creates transition setters', function(t) {
        var set = new StyleDeclarationSet('paint', 'background');
        set['background-color-transition'] = {duration: 400};
        t.deepEqual(set._transitions, {'background-color': {duration: 400}});
        t.end();
    });

    t.test('constructs with a property set', function(t) {
        var set = new StyleDeclarationSet('paint', 'background', {
            'background-color': 'blue'
        });
        t.deepEqual(set._values['background-color'].value, [0, 0, 1, 1]);
        t.end();
    });

    t.test('returns external representation', function(t) {
        var set = new StyleDeclarationSet('paint', 'background');
        set['background-color'] = 'blue';
        set['background-color-transition'] = {duration: 400};
        t.deepEqual(set.json(), {
            'background-color': [0, 0, 1, 1],
            'background-color-transition': {duration: 400}
        });
        t.end();
    });
});
