import { test } from 'mapbox-gl-js-test';
import { mapObject } from '../../../src/util/util';
import StyleLayerIndex from '../../../src/style/style_layer_index';

test('StyleLayerIndex#replace', (t) => {
    const index = new StyleLayerIndex([
        { id: '1', type: 'fill', source: 'source', 'source-layer': 'layer', paint: { 'fill-color': 'red' }  },
        { id: '2', type: 'circle', source: 'source', 'source-layer': 'layer', paint: { 'circle-color': 'green' }  },
        { id: '3', type: 'circle', source: 'source', 'source-layer': 'layer', paint: { 'circle-color': 'blue' } }
    ]);

    const families = index.familiesBySource['source']['layer'];
    t.equal(families.length, 2);
    t.equal(families[0].length, 1);
    t.equal(families[0][0].id, '1');
    t.equal(families[1].length, 2);
    t.equal(families[1][0].id, '2');
    t.equal(families[1][1].id, '3');

    index.replace([]);
    t.deepEqual(index.familiesBySource, {});

    t.end();
});

test('StyleLayerIndex#update', (t) => {
    const index = new StyleLayerIndex([
        { id: '1', type: 'fill', source: 'foo', 'source-layer': 'layer', paint: { 'fill-color': 'red' } },
        { id: '2', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: { 'circle-color': 'green' } },
        { id: '3', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: { 'circle-color': 'blue' } }
    ]);

    index.update([
        { id: '1', type: 'fill', source: 'bar', 'source-layer': 'layer', paint: { 'fill-color': 'cyan' } },
        { id: '2', type: 'circle', source: 'bar', 'source-layer': 'layer', paint: { 'circle-color': 'magenta' } },
        { id: '3', type: 'circle', source: 'bar', 'source-layer': 'layer', paint: { 'circle-color': 'yellow' } }
    ], []);

    const families = index.familiesBySource['bar']['layer'];
    t.equal(families.length, 2);
    t.equal(families[0].length, 1);
    t.equal(families[0][0].getPaintProperty('fill-color'), 'cyan');
    t.equal(families[1].length, 2);
    t.equal(families[1][0].getPaintProperty('circle-color'), 'magenta');
    t.equal(families[1][0].source, 'bar');
    t.equal(families[1][1].getPaintProperty('circle-color'), 'yellow');
    t.equal(families[1][1].source, 'bar');

    t.end();
});

test('StyleLayerIndex#familiesBySource', (t) => {
    const index = new StyleLayerIndex([
        { id: '0', type: 'fill', 'source': 'A', 'source-layer': 'foo' },
        { id: '1', type: 'fill', 'source': 'A', 'source-layer': 'foo' },
        { id: '2', type: 'fill', 'source': 'A', 'source-layer': 'foo', 'minzoom': 1 },
        { id: '3', type: 'fill', 'source': 'A', 'source-layer': 'bar' },
        { id: '4', type: 'fill', 'source': 'B', 'source-layer': 'foo' },
        { id: '5', type: 'fill', 'source': 'geojson' },
        { id: '6', type: 'background' }
    ]);

    const ids = mapObject(index.familiesBySource, (bySource) => {
        return mapObject(bySource, (families) => {
            return families.map((family) => {
                return family.map((layer) => layer.id);
            });
        });
    });

    t.deepEqual(ids, {
        'A': {
            'foo': [['0', '1'], ['2']],
            'bar': [['3']]
        },
        'B': {
            'foo': [['4']]
        },
        'geojson': {
            '_geojsonTileLayer': [['5']]
        },
        '': {
            '_geojsonTileLayer': [['6']]
        }
    });

    t.end();
});

test('StyleLayerIndex groups families even if layout key order differs', (t) => {
    const index = new StyleLayerIndex([
        { id: '0', type: 'line', 'source': 'source', 'source-layer': 'layer',
            'layout': {'line-cap': 'butt', 'line-join': 'miter'} },
        { id: '1', type: 'line', 'source': 'source', 'source-layer': 'layer',
            'layout': {'line-join': 'miter', 'line-cap': 'butt'} }
    ]);

    const families = index.familiesBySource['source']['layer'];
    t.equal(families[0].length, 2);

    t.end();
});
