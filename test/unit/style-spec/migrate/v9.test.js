import {test, expect} from "../../../util/vitest.js";
import migrate from '../../../../src/style-spec/migrate/v9.js';

test('deref layers', () => {
    const input = {
        version: 8,
        sources: {
            a: {type: 'vector', tiles: [ 'http://dev/null' ]}
        },
        layers: [{
            id: 'parent',
            source: 'a',
            'source-layer': 'x',
            type: 'fill'
        }, {
            id: 'child',
            ref: 'parent'
        }]
    };

    expect(migrate(input)).toEqual({
        version: 9,
        sources: {
            a: {type: 'vector', tiles: [ 'http://dev/null' ]}
        },
        layers: [{
            id: 'parent',
            source: 'a',
            'source-layer': 'x',
            type: 'fill'
        }, {
            id: 'child',
            source: 'a',
            'source-layer': 'x',
            type: 'fill'
        }]
    });
});

test('declass style', () => {
    const input = {
        version: 8,
        sources: {
            a: {type: 'vector', tiles: [ 'http://dev/null' ]}
        },
        layers: [{
            id: 'a',
            source: 'a',
            type: 'fill',
            paint: {},
            'paint.right': {
                'fill-color': 'red'
            },
            'paint.left': {
                'fill-color': 'blue'
            }
        }]
    };

    expect(migrate(input)).toEqual({
        version: 9,
        sources: {
            a: {type: 'vector', tiles: [ 'http://dev/null' ]}
        },
        layers: [{
            id: 'a',
            source: 'a',
            type: 'fill',
            paint: {}
        }]
    });
});
