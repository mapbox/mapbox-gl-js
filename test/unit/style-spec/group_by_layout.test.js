import {test, expect} from "../../util/vitest.js";
import group from '../../../src/style-spec/group_by_layout.js';

test('group layers whose ref properties are identical', () => {
    const a = {
        'id': 'parent',
        'type': 'line'
    };
    const b = {
        'id': 'child',
        'type': 'line'
    };
    expect(group([a, b], {})).toEqual([[a, b]]);
    expect(group([a, b], {})[0][0]).toEqual(a);
    expect(group([a, b], {})[0][1]).toEqual(b);
});

test('group does not group unrelated layers', () => {
    expect(group([
        {
            'id': 'parent',
            'type': 'line'
        },
        {
            'id': 'child',
            'type': 'fill'
        }
    ], {})).toEqual([
        [{
            'id': 'parent',
            'type': 'line'
        }], [{
            'id': 'child',
            'type': 'fill'
        }]
    ]);
});

test('group works even for differing layout key orders', () => {
    expect(group([
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
    ], {})).toEqual([[
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
});
