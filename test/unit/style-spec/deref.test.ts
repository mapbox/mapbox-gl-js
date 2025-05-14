// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import deref from '../../../src/style-spec/deref';

test('derefs a ref layer which follows its parent', () => {
    expect(deref([
        {
            'id': 'parent',
            'type': 'line'
        },
        {
            'id': 'child',
            'ref': 'parent'
        }
    ])).toEqual([
        {
            'id': 'parent',
            'type': 'line'
        },
        {
            'id': 'child',
            'type': 'line'
        }
    ]);
});

test('derefs a ref layer which precedes its parent', () => {
    expect(deref([
        {
            'id': 'child',
            'ref': 'parent'
        },
        {
            'id': 'parent',
            'type': 'line'
        }
    ])).toEqual([
        {
            'id': 'child',
            'type': 'line'
        },
        {
            'id': 'parent',
            'type': 'line'
        }
    ]);
});
