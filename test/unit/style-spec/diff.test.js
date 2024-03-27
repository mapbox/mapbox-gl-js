import {test, expect} from "../../util/vitest.js";
import diffStyles from '../../../src/style-spec/diff.js';

test('diff', () => {
    expect(diffStyles({
        layers: [{id: 'a'}]
    }, {
        layers: [{id: 'a'}]
    })).toEqual([]);

    expect(diffStyles({
        version: 7,
        layers: [{id: 'a'}]
    }, {
        version: 8,
        layers: [{id: 'a'}]
    })).toEqual([
        {command: 'setStyle', args: [{version: 8, layers: [{id: 'a'}]}]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a'}]
    }, {
        layers: [{id: 'a'}, {id: 'b'}]
    })).toEqual([
        {command: 'addLayer', args: [{id: 'b'}, undefined]}
    ]);

    expect(diffStyles({
        layers: [{id: 'b'}]
    }, {
        layers: [{id: 'a'}, {id: 'b'}]
    })).toEqual([
        {command: 'addLayer', args: [{id: 'a'}, 'b']}
    ]);

    expect(diffStyles({
        layers: [{id: 'a'}, {id: 'b', source: 'foo', nested: [1]}]
    }, {
        layers: [{id: 'a'}]
    })).toEqual([
        {command: 'removeLayer', args: ['b']}
    ]);

    expect(diffStyles({
        layers: [{id: 'a'}, {id: 'b'}]
    }, {
        layers: [{id: 'b'}, {id: 'a'}]
    })).toEqual([
        {command: 'removeLayer', args: ['a']},
        {command: 'addLayer', args: [{id: 'a'}, undefined]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', paint: {foo: 1}}]
    }, {
        layers: [{id: 'a', paint: {foo: 2}}]
    })).toEqual([
        {command: 'setPaintProperty', args: ['a', 'foo', 2, null]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', 'paint.light': {foo: 1}}]
    }, {
        layers: [{id: 'a', 'paint.light': {foo: 2}}]
    })).toEqual([
        {command: 'setPaintProperty', args: ['a', 'foo', 2, 'light']}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', paint: {foo: {ramp: [1, 2]}}}]
    }, {
        layers: [{id: 'a', paint: {foo: {ramp: [1]}}}]
    })).toEqual([
        {command: 'setPaintProperty', args: ['a', 'foo', {ramp: [1]}, null]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', layout: {foo: 1}}]
    }, {
        layers: [{id: 'a', layout: {foo: 2}}]
    })).toEqual([
        {command: 'setLayoutProperty', args: ['a', 'foo', 2, null]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', filter: ['==', 'foo', 'bar']}]
    }, {
        layers: [{id: 'a', filter: ['==', 'foo', 'baz']}]
    })).toEqual([
        {command: 'setFilter', args: ['a', [ '==', 'foo', 'baz' ] ]}
    ]);

    expect(diffStyles({
        sources: {foo: 1}
    }, {
        sources: {}
    })).toEqual([
        {command: 'removeSource', args: ['foo']}
    ]);

    expect(diffStyles({
        sources: {}
    }, {
        sources: {foo: 1}
    })).toEqual([
        {command: 'addSource', args: ['foo', 1]}
    ]);

    expect(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []}
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
                        geometry: {type: 'Point', coordinates: [10, 20]}
                    }]
                }
            }
        }
    })).toEqual([
        {command: 'setGeoJSONSourceData', args: ['foo', {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [10, 20]}
            }]
        }]}
    ]);

    expect(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []}
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []},
                cluster: true
            }
        }
    })).toEqual([
        {command: 'removeSource', args: ['foo']},
        {command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            data: {type: 'FeatureCollection', features: []}
        }]}
    ]);

    expect(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []},
                cluster: true
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []},
                cluster: true,
                clusterRadius: 100
            }
        }
    })).toEqual([
        {command: 'removeSource', args: ['foo']},
        {command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            clusterRadius: 100,
            data: {type: 'FeatureCollection', features: []}
        }]}
    ]);

    expect(diffStyles({
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []},
                cluster: true,
                clusterRadius: 100
            }
        }
    }, {
        sources: {
            foo: {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: []},
                cluster: true
            }
        }
    })).toEqual([
        {command: 'removeSource', args: ['foo']},
        {command: 'addSource', args: ['foo', {
            type: 'geojson',
            cluster: true,
            data: {type: 'FeatureCollection', features: []}
        }]}
    ]);

    expect(diffStyles({}, {
        metadata: {'mapbox:author': 'nobody'}
    })).toEqual([]);

    expect(diffStyles({
        layers: [{id: 'a', metadata: {'mapbox:group': 'Group Name'}}]
    }, {
        layers: [{id: 'a', metadata: {'mapbox:group': 'Another Name'}}]
    })).toEqual([]);

    expect(diffStyles({
        center: [0, 0]
    }, {
        center: [1, 1]
    })).toEqual([
        {command: 'setCenter', args: [[1, 1]]}
    ]);

    expect(diffStyles({
        zoom: 12
    }, {
        zoom: 15
    })).toEqual([
        {command: 'setZoom', args: [15]}
    ]);

    expect(diffStyles({
        bearing: 0
    }, {
        bearing: 180
    })).toEqual([
        {command: 'setBearing', args: [180]}
    ]);

    expect(diffStyles({
        pitch: 0
    }, {
        pitch: 1
    })).toEqual([
        {command: 'setPitch', args: [1]}
    ]);

    expect(diffStyles({
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
    })).toEqual([
    ]);

    expect(diffStyles({
        light: {anchor: 'map'}
    }, {
        light: {anchor: 'viewport'}
    })).toEqual([
        {command: 'setLight', args: [{'anchor': 'viewport'}]}
    ]);

    expect(diffStyles({
        light: {color: 'white'}
    }, {
        light: {color: 'red'}
    })).toEqual([
        {command: 'setLight', args: [{'color': 'red'}]}
    ]);

    expect(diffStyles({
        light: {position: [0, 1, 0]}
    }, {
        light: {position: [1, 0, 0]}
    })).toEqual([
        {command: 'setLight', args: [{'position': [1, 0, 0]}]}
    ]);

    expect(diffStyles({
        light: {intensity: 1}
    }, {
        light: {intensity: 10}
    })).toEqual([
        {command: 'setLight', args: [{'intensity': 10}]}
    ]);

    expect(diffStyles({
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
    })).toEqual([
        {command: 'setLight', args: [{
            anchor: 'map',
            color: 'red',
            position: [1, 40, 30],
            intensity: 1.0
        }]}
    ]);

    expect(diffStyles({
        layers: [ {id: 'a', source: 'source-one'} ]
    }, {
        layers: [ {id: 'a', source: 'source-two'} ]
    })).toEqual([
        {command: 'removeLayer', args: ['a']},
        {command: 'addLayer', args: [{id: 'a', source: 'source-two'}, undefined]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', type: 'fill'}]
    }, {
        layers: [{id: 'a', type: 'line'}]
    })).toEqual([
        {command: 'removeLayer', args: ['a']},
        {command: 'addLayer', args: [{id: 'a', type: 'line'}, undefined]}
    ]);

    expect(diffStyles({
        layers: [{id: 'a', source: 'a', 'source-layer': 'layer-one'}]
    }, {
        layers: [{id: 'a', source: 'a', 'source-layer': 'layer-two'}]
    })).toEqual([
        {command: 'removeLayer', args: ['a']},
        {command: 'addLayer', args: [{id: 'a', source: 'a', 'source-layer': 'layer-two'}, undefined]}
    ]);

    expect(diffStyles({
        layers: [
            {id: 'b'},
            {id: 'c'},
            {id: 'a', type: 'fill'}
        ]
    }, {
        layers: [
            {id: 'c'},
            {id: 'a', type: 'line'},
            {id: 'b'}
        ]
    })).toEqual([
        {command: 'removeLayer', args: ['b']},
        {command: 'addLayer', args: [{id: 'b'}, undefined]},
        {command: 'removeLayer', args: ['a']},
        {command: 'addLayer', args: [{id: 'a', type: 'line'}, 'b']}
    ]);

    expect(diffStyles({
        sources: {foo: {data: 1}, bar: {}},
        layers: [
            {id: 'a', source: 'bar'},
            {id: 'b', source: 'foo'},
            {id: 'c', source: 'bar'}
        ]
    }, {
        sources: {foo: {data: 2}, bar: {}},
        layers: [
            {id: 'a', source: 'bar'},
            {id: 'b', source: 'foo'},
            {id: 'c', source: 'bar'}
        ]
    })).toEqual([
        {command: 'removeLayer', args: ['b']},
        {command: 'removeSource', args: ['foo']},
        {command: 'addSource', args: ['foo', {data: 2}]},
        {command: 'addLayer', args: [{id: 'b', source: 'foo'}, 'c']}
    ]);

    expect(diffStyles({
        sources: {foo: {data: 1}, bar: {}},
        layers: [
            {id: 'a', source: 'bar'}
        ]
    }, {
        sources: {foo: {data: 1}, bar: {}},
        layers: [
            {id: 'a', source: 'bar'}
        ],
        transition: 'transition'
    })).toEqual([
        {command: 'setTransition', args: ['transition']}
    ]);

    expect(diffStyles({
        'fog': {
            'range': [1000, 2000],
            'color': 'white',
            'horizon-blend': 0.05
        }
    }, {
        'fog': {
            'range': [1000, 2000],
            'color': 'white',
            'horizon-blend': 0.05
        }
    })).toEqual([
    ]);

    expect(diffStyles({
        'fog': {
            'range': [1000, 2000],
            'color': 'white',
            'horizon-blend': 0.05
        }
    }, {
        'fog': {
            'range': [0, 2000],
            'color': 'blue',
            'horizon-blend': 0.5
        }
    })).toEqual([{
        command: 'setFog',
        args: [{
            'range': [0, 2000],
            'color': 'blue',
            'horizon-blend': 0.5
        }]
    }]);

    expect(diffStyles({
        imports: [{id: 'a', url: ''}]
    }, {
        imports: [{id: 'a', url: ''}, {id: 'b', url: ''}]
    })).toEqual([
        {command: 'addImport', args: [{id: 'b', url: ''}, undefined]}
    ]);

    expect(diffStyles({
        imports: [{id: 'b', url: ''}]
    }, {
        imports: [{id: 'a', url: ''}, {id: 'b', url: ''}]
    })).toEqual([
        {command: 'addImport', args: [{id: 'a', url: ''}, 'b']}
    ]);

    expect(diffStyles({
        imports: [{id: 'a', url: ''}, {id: 'b', url: ''}]
    }, {
        imports: [{id: 'a', url: ''}]
    })).toEqual([
        {command: 'removeImport', args: ['b']}
    ]);

    expect(diffStyles({
        imports: [{id: 'a', url: ''}, {id: 'b', url: ''}]
    }, {
        imports: [{id: 'b', url: ''}, {id: 'a', url: ''}]
    })).toEqual([
        {command: 'removeImport', args: ['a']},
        {command: 'addImport', args: [{id: 'a', url: ''}, undefined]}
    ]);

    expect(diffStyles({
        'imports': [{
            'id': 'basemap',
            'url': 'before'
        }]
    }, {
        'imports': [{
            'id': 'basemap',
            'url': 'after'
        }]
    })).toEqual([{
        command: 'updateImport',
        args: ['basemap', {id: 'basemap', url: 'after'}]
    }]);

    expect(diffStyles({
        'imports': [{
            'id': 'basemap',
            'url': '',
            'data': {
                'version': 8
            }
        }]
    }, {
        'imports': [{
            'id': 'basemap',
            'url': '',
            'data': {
                'version': 9
            }
        }]
    })).toEqual([{
        command: 'updateImport',
        args: ['basemap', {
            id: 'basemap',
            url: '',
            data: {
                'version': 9
            }
        }]
    }]);

    expect(diffStyles({
        'layers': [{
            'id': 'national-park',
            'type': 'fill',
            'slot': 'below-water',
            'paint': {'fill-color': 'green'}
        }],
        'imports': [{
            'id': 'basemap',
            'url': '',
            'data': {
                'version': 8,
                'layers': [
                    {'id': 'below-water', 'type': 'slot'},
                    {'id': 'water', 'type': 'fill', 'layout': {}, 'paint': {'fill-color': 'blue'}},
                    {'id': 'above-water', 'type': 'slot'}
                ]
            }
        }]
    }, {
        'layers': [{
            'id': 'national-park',
            'type': 'fill',
            'slot': 'above-water',
            'paint': {'fill-color': 'violet'}
        }],
        'imports': [{
            'id': 'basemap',
            'url': '',
            'data': {
                'version': 8,
                'layers': [
                    {'id': 'below-water', 'type': 'slot'},
                    {'id': 'water', 'type': 'background', 'layout': {}, 'paint': {'background-color': 'pink'}},
                    {'id': 'above-water', 'type': 'slot'}
                ]
            },
        }]
    })).toEqual([{
        command: 'updateImport',
        args: ['basemap', {
            id: 'basemap',
            url: '',
            data: {
                'version': 8,
                'layers': [
                    {'id': 'below-water', 'type': 'slot'},
                    {'id': 'water', 'type': 'background', 'layout': {}, 'paint': {'background-color': 'pink'}},
                    {'id': 'above-water', 'type': 'slot'}
                ]
            }
        }]
    }, {
        command: 'setPaintProperty',
        args: ['national-park', 'fill-color', 'violet', null]
    }, {
        command: 'setSlot',
        args: ['national-park', 'above-water']
    }]);
});
