'use strict';

var t = require('tape'),
    group = require('../lib/group_by_layout');

t('group layers whose ref properties are identical', function (t) {
    var a = {
        'id': 'parent',
        'type': 'line'
    };
    var b = {
        'id': 'child',
        'type': 'line'
    };
    t.deepEqual(group([a, b]), [[a, b]]);
    t.equal(group([a, b])[0][0], a);
    t.equal(group([a, b])[0][1], b);
    t.end();
});

t('group does not group unrelated layers', function (t) {
    t.deepEqual(group([
        {
            'id': 'parent',
            'type': 'line'
        },
        {
            'id': 'child',
            'type': 'fill'
        }
    ]), [
        [{
            'id': 'parent',
            'type': 'line'
        }], [{
            'id': 'child',
            'type': 'fill'
        }]
    ]);
    t.end();
});

t('group works even for differing layout key orders', function (t) {
    t.deepEqual(group([
        {
            'id': 'parent',
            'type': 'line',
            'layout': {'a': 1, 'b': 2}
        },
        {
            'id': 'child',
            'type': 'line',
            'layout': {'b': 2, 'a': 1}
        }
    ]), [[
        {
            'id': 'parent',
            'type': 'line',
            'layout': {'a': 1, 'b': 2}
        },
        {
            'id': 'child',
            'type': 'line',
            'layout': {'b': 2, 'a': 1}
        }
    ]]);
    t.end();
});
