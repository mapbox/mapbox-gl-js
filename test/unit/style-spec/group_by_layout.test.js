'use strict';

const t = require('mapbox-gl-js-test').test,
    group = require('../../../src/style-spec/group_by_layout');

t('group layers whose ref properties are identical', (t) => {
    const a = {
        'id': 'parent',
        'type': 'line'
    };
    const b = {
        'id': 'child',
        'type': 'line'
    };
    t.deepEqual(group([a, b]), [[a, b]]);
    t.equal(group([a, b])[0][0], a);
    t.equal(group([a, b])[0][1], b);
    t.end();
});

t('group does not group unrelated layers', (t) => {
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

t('group works even for differing layout key orders', (t) => {
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
