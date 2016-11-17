'use strict';

var t = require('tape'),
    migrate = require('../../migrations/v9');

t('deref layers', function (t) {
    var input = {
        version: 8,
        sources: {
            a: { type: 'vector', tiles: [ 'http://dev/null' ] }
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
            a: { type: 'vector', tiles: [ 'http://dev/null' ] }
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

t('declass style', function (t) {
    var input = {
        version: 8,
        sources: {
            a: { type: 'vector', tiles: [ 'http://dev/null' ] }
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
            a: { type: 'vector', tiles: [ 'http://dev/null' ] }
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
