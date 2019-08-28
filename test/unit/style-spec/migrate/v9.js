import {test} from '../../../util/test';
import migrate from '../../../../src/style-spec/migrate/v9';

test('deref layers', (t) => {
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

    t.deepEqual(migrate(input), {
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

    t.end();
});

test('declass style', (t) => {
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

    t.deepEqual(migrate(input), {
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

    t.end();
});
