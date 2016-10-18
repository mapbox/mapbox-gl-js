'use strict';

const test = require('mapbox-gl-js-test').test;
const StyleLayerIndex = require('../../../js/style/style_layer_index');

test('StyleLayerIndex', (t) => {
    const index = new StyleLayerIndex();
    t.deepEqual(index.families, []);
    t.end();
});

test('StyleLayerIndex#replace', (t) => {
    const index = new StyleLayerIndex([
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    t.equal(index.families.length, 2);
    t.equal(index.families[0].length, 1);
    t.equal(index.families[0][0].id, 'one');
    t.equal(index.families[1].length, 2);
    t.equal(index.families[1][0].id, 'two');
    t.equal(index.families[1][1].id, 'three');

    index.replace([]);
    t.deepEqual(index.families, []);

    t.end();
});

test('StyleLayerIndex#update', (t) => {
    const index = new StyleLayerIndex([
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }, 'source': 'foo' },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }, 'source': 'foo' },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    index.update([
        { id: 'one', type: 'circle', paint: { 'circle-color': 'cyan' }, 'source': 'bar' },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'magenta' }, 'source': 'bar' },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'yellow' } }
    ]);

    t.equal(index.families.length, 2);
    t.equal(index.families[0].length, 1);
    t.equal(index.families[0][0].getPaintProperty('circle-color'), 'cyan');
    t.equal(index.families[1].length, 2);
    t.equal(index.families[1][0].getPaintProperty('circle-color'), 'magenta');
    t.equal(index.families[1][0].source, 'bar');
    t.equal(index.families[1][1].getPaintProperty('circle-color'), 'yellow');
    t.equal(index.families[1][1].source, 'bar');

    t.end();
});
