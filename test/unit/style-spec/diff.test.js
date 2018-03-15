import { test as t } from 'mapbox-gl-js-test';
import diffStyles from '../../../src/style-spec/diff';

t('diff', (t) => {

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }]
    }, {
        layers: [{ id: 'a' }]
    }), [], 'no changes');

    t.deepEqual(diffStyles({
        version: 7,
        layers: [{ id: 'a' }]
    }, {
        version: 8,
        layers: [{ id: 'a' }]
    }), [
        { command: 'setStyle', args: [{ version: 8, layers: [{ id: 'a' }] }] }
    ], 'version change');


    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [
        { command: 'addLayer', args: [{ id: 'b' }, undefined] }
    ], 'add a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'b' }]
    }, {
        layers: [{ id: 'a' }, { id: 'b' }]
    }), [
        { command: 'addLayer', args: [{ id: 'a' }, 'b'] }
    ], 'add a layer before another');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }, { id: 'b', source: 'foo', nested: [1] }]
    }, {
        layers: [{ id: 'a' }]
    }), [
        { command: 'removeLayer', args: ['b'] }
    ], 'remove a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a' }, { id: 'b' }]
    }, {
        layers: [{ id: 'b' }, { id: 'a' }]
    }), [
        { command: 'removeLayer', args: ['a'] },
        { command: 'addLayer', args: [{ id: 'a' }, undefined] }
    ], 'move a layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', paint: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', paint: { foo: 2 } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', 2, null] }
    ], 'update paint property');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', 'paint.light': { foo: 1 } }]
    }, {
        layers: [{ id: 'a', 'paint.light': { foo: 2 } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', 2, 'light'] }
    ], 'update paint property class');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', paint: { foo: { ramp: [1, 2] } } }]
    }, {
        layers: [{ id: 'a', paint: { foo: { ramp: [1] } } }]
    }), [
        { command: 'setPaintProperty', args: ['a', 'foo', { ramp: [1] }, null] }
    ], 'nested style change');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', layout: { foo: 1 } }]
    }, {
        layers: [{ id: 'a', layout: { foo: 2 } }]
    }), [
        { command: 'setLayoutProperty', args: ['a', 'foo', 2, null] }
    ], 'update layout property');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', filter: ['==', 'foo', 'bar'] }]
    }, {
        layers: [{ id: 'a', filter: ['==', 'foo', 'baz'] }]
    }), [
        { command: 'setFilter', args: ['a', [ '==', 'foo', 'baz' ] ] }
    ], 'update a filter');

    t.deepEqual(diffStyles({
        sources: { foo: 1 }
    }, {
        sources: {}
    }), [
        { command: 'removeSource', args: ['foo'] }
    ], 'remove a source');

    t.deepEqual(diffStyles({
        sources: {}
    }, {
        sources: { foo: 1 }
    }), [
        { command: 'addSource', args: ['foo', 1] }
    ], 'add a source');

    t.deepEqual(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [10, 20] }
                    }]
                }
            }
        }
    }), [
        { command: 'setGeoJSONSourceData', args: ['foo', {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [10, 20] }
            }]
        }]}
    ], 'update a geojson source');

    t.deepEqual(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                cluster: true
            }
        }
    }), [
        { command: 'removeSource', args: ['foo'] },
        { command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            data: { type: 'FeatureCollection', features: [] }
        }]}
    ], 'remove and re-add a source if cluster changes');

    t.deepEqual(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                cluster: true
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                cluster: true,
                clusterRadius: 100
            }
        }
    }), [
        { command: 'removeSource', args: ['foo'] },
        { command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            clusterRadius: 100,
            data: { type: 'FeatureCollection', features: [] }
        }]}
    ], 'remove and re-add a source if cluster radius changes');

    t.deepEqual(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                cluster: true,
                clusterRadius: 100
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                cluster: true
            }
        }
    }), [
        { command: 'removeSource', args: ['foo'] },
        { command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            data: { type: 'FeatureCollection', features: [] }
        }]}
    ], 'remove and re-add a source if cluster radius changes (before and after swapped)');

    t.deepEqual(diffStyles({}, {
        metadata: { 'mapbox:author': 'nobody' }
    }), [], 'ignore style metadata');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', metadata: { 'mapbox:group': 'Group Name' } }]
    }, {
        layers: [{ id: 'a', metadata: { 'mapbox:group': 'Another Name' } }]
    }), [], 'ignore layer metadata');

    t.deepEqual(diffStyles({
        center: [0, 0]
    }, {
        center: [1, 1]
    }), [
        { command: 'setCenter', args: [[1, 1]] }
    ], 'center change');

    t.deepEqual(diffStyles({
        zoom: 12
    }, {
        zoom: 15
    }), [
        { command: 'setZoom', args: [15] }
    ], 'zoom change');

    t.deepEqual(diffStyles({
        bearing: 0
    }, {
        bearing: 180
    }), [
        { command: 'setBearing', args: [180] }
    ], 'bearing change');

    t.deepEqual(diffStyles({
        pitch: 0
    }, {
        pitch: 1
    }), [
        { command: 'setPitch', args: [1] }
    ], 'pitch change');

    t.deepEqual(diffStyles({
        light: {
            anchor: 'map',
            color: 'white',
            position: [0, 1, 0],
            intensity: 1
        }
    }, {
        light: {
            anchor: 'map',
            color: 'white',
            position: [0, 1, 0],
            intensity: 1
        }
    }), [
    ], 'light no change');

    t.deepEqual(diffStyles({
        light: { anchor: 'map' }
    }, {
        light: { anchor: 'viewport' }
    }), [
        { command: 'setLight', args: [{'anchor': 'viewport'}] }
    ], 'light anchor change');

    t.deepEqual(diffStyles({
        light: { color: 'white' }
    }, {
        light: { color: 'red' }
    }), [
        { command: 'setLight', args: [{'color': 'red'}] }
    ], 'light color change');

    t.deepEqual(diffStyles({
        light: { position: [0, 1, 0] }
    }, {
        light: { position: [1, 0, 0] }
    }), [
        { command: 'setLight', args: [{'position': [1, 0, 0]}] }
    ], 'light position change');

    t.deepEqual(diffStyles({
        light: { intensity: 1 }
    }, {
        light: { intensity: 10 }
    }), [
        { command: 'setLight', args: [{'intensity': 10}] }
    ], 'light intensity change');

    t.deepEqual(diffStyles({
        light: {
            anchor: 'map',
            color: 'orange',
            position: [2, 80, 30],
            intensity: 1.0
        }
    }, {
        light: {
            anchor: 'map',
            color: 'red',
            position: [1, 40, 30],
            intensity: 1.0
        }
    }), [
        { command: 'setLight', args: [{
            anchor: 'map',
            color: 'red',
            position: [1, 40, 30],
            intensity: 1.0
        }] }
    ], 'multiple light properties change');

    t.deepEqual(diffStyles({
        layers: [ { id: 'a', source: 'source-one' } ]
    }, {
        layers: [ { id: 'a', source: 'source-two' } ]
    }), [
        { command: 'removeLayer', args: ['a'] },
        { command: 'addLayer', args: [{ id: 'a', source: 'source-two' }, undefined] }
    ], 'updating a layer\'s source removes/re-adds the layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', type: 'fill' }]
    }, {
        layers: [{ id: 'a', type: 'line' }]
    }), [
        { command: 'removeLayer', args: ['a'] },
        { command: 'addLayer', args: [{ id: 'a', type: 'line' }, undefined] }
    ], 'updating a layer\'s type removes/re-adds the layer');

    t.deepEqual(diffStyles({
        layers: [{ id: 'a', source: 'a', 'source-layer': 'layer-one' }]
    }, {
        layers: [{ id: 'a', source: 'a', 'source-layer': 'layer-two' }]
    }), [
        { command: 'removeLayer', args: ['a'] },
        { command: 'addLayer', args: [{ id: 'a', source: 'a', 'source-layer': 'layer-two' }, undefined] }
    ], 'updating a layer\'s source-layer removes/re-adds the layer');

    t.deepEqual(diffStyles({
        layers: [
            { id: 'b' },
            { id: 'c' },
            { id: 'a', type: 'fill' }
        ]
    }, {
        layers: [
            { id: 'c' },
            { id: 'a', type: 'line' },
            { id: 'b' }
        ]
    }), [
        { command: 'removeLayer', args: ['b'] },
        { command: 'addLayer', args: [{id: 'b'}, undefined] },
        { command: 'removeLayer', args: ['a'] },
        { command: 'addLayer', args: [{ id: 'a', type: 'line' }, 'b'] }
    ], 'pair respects layer reordering');

    t.deepEqual(diffStyles({
        sources: { foo: { data: 1 }, bar: {} },
        layers: [
            { id: 'a', source: 'bar' },
            { id: 'b', source: 'foo' },
            { id: 'c', source: 'bar' }
        ]
    }, {
        sources: { foo: { data: 2 }, bar: {} },
        layers: [
            { id: 'a', source: 'bar' },
            { id: 'b', source: 'foo' },
            { id: 'c', source: 'bar' }
        ]
    }), [
        { command: 'removeLayer', args: ['b'] },
        { command: 'removeSource', args: ['foo'] },
        { command: 'addSource', args: ['foo', { data: 2 }] },
        { command: 'addLayer', args: [{id: 'b', source: 'foo'}, 'c'] }
    ], 'changing a source removes and re-adds dependent layers');

    t.deepEqual(diffStyles({
        sources: { foo: { data: 1 }, bar: {} },
        layers: [
            { id: 'a', source: 'bar' }
        ]
    }, {
        sources: { foo: { data: 1 }, bar: {} },
        layers: [
            { id: 'a', source: 'bar' }
        ],
        transition: 'transition'
    }), [
        { command: 'setTransition', args: ['transition'] }
    ], 'changing transition');

    t.end();
});
