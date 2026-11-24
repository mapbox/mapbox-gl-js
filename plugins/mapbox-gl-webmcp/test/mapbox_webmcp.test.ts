import * as mapboxgl from 'mapbox-gl';
import {describe, test, expect, onTestFinished, vi} from 'vitest';
import {MapboxWebMCP} from '../src/index';
import {tools, camera, marker, popup} from '../src/tools/index';

import type {MapboxWebMCPTool, MapboxWebMCPToolResult} from '../src/index';
import type {ObjectSchema} from '../src/schema';
import type {FilterSpecification} from 'mapbox-gl';

type RegisteredTool = {name: string; execute: (input: object) => Promise<MapboxWebMCPToolResult>};

async function addControl<const T extends Record<string, ObjectSchema>>(ownTools: {[K in keyof T]: MapboxWebMCPTool<T[K]>}, style: mapboxgl.StyleSpecification = {version: 8, sources: {}, layers: []}, registered = new Map<string, RegisteredTool>(), mapOptions: Partial<mapboxgl.MapOptions> = {}) {
    Object.defineProperty(document, 'modelContext', {configurable: true, value: {
        registerTool: (tool: RegisteredTool, {signal}: {signal: AbortSignal}) => {
            if (registered.has(tool.name)) throw new DOMException(`Duplicate tool name: ${tool.name}`, 'InvalidStateError');
            registered.set(tool.name, tool);
            signal.addEventListener('abort', () => registered.delete(tool.name));
        }
    }});
    const container = document.createElement('div');
    container.style.cssText = 'width: 400px; height: 400px';
    document.body.append(container);
    const map = new mapboxgl.Map({container, zoom: 3, style, ...mapOptions});
    onTestFinished(() => {
        map.remove();
        container.remove();
        Reflect.deleteProperty(document, 'modelContext');
    });
    await map.once('load');
    const control = new MapboxWebMCP({mapboxgl, tools: ownTools});
    map.addControl(control);
    const run = async (name: string, input: object) => {
        const result = await registered.get(name)!.execute(input);
        if (result.type === 'error') throw new Error(result.error.message);
        return result.value as Record<string, unknown>;
    };
    return {map, control, registered, run};
}

const testSchema = {type: 'object', properties: {a: {type: 'number'}}} as const;
const tool = (execute: MapboxWebMCPTool<typeof testSchema>['execute']) => ({test: {description: 'Test', inputSchema: testSchema, execute}});

describe('MapboxWebMCP', () => {
    test('a renamed tool runs under its new name', async () => {
        const {run} = await addControl({pins: marker});
        const [{id}] = await run('pins', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
        expect(await run('pins', {action: 'list'})).toEqual([expect.objectContaining({id, lngLat: {lng: 10, lat: 20}})]);
    });

    test('a built-in tool result with unset optional fields has no note', async () => {
        const {registered} = await addControl({pins: marker});
        const result = await registered.get('pins')!.execute({action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]});
        expect(result).not.toHaveProperty('note');
    });

    test('a taken name skips only that tool and warns with its name', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());
        const taken = {name: 'camera', execute: () => Promise.resolve({type: 'success', value: 'page'} as const)};
        const {registered} = await addControl({camera, marker}, undefined, new Map([['camera', taken]]));
        await vi.waitFor(() => expect(warn).toHaveBeenCalled());
        expect({names: [...registered.keys()], camera: registered.get('camera'), warnings: warn.mock.calls.map(([message]) => String(message))}).toEqual({
            names: ['camera', 'marker'], camera: taken, warnings: ['MapboxWebMCP could not register the tool "camera".']
        });
    });

    test('a tool gets the input and the map, and returns its value as JSON', async () => {
        const {registered} = await addControl(tool((input, map) => ({input, zoom: map.getZoom()})));
        expect(await registered.get('test')!.execute({a: 1})).toStrictEqual({type: 'success', value: {input: {a: 1}, zoom: 3}});
    });

    test('a tool result with values JSON can\'t hold comes back with a note that counts them', async () => {
        const {registered} = await addControl(tool(() => ({a: NaN, b: undefined, c: [Infinity, 1]})));
        expect(await registered.get('test')!.execute({})).toStrictEqual({type: 'success', value: {a: null, c: [null, 1]}, note: 'JSON can\'t hold 3 of the values, such as NaN, Infinity or undefined, so they came back as null or were left out.'});
    });

    test('a tool that throws returns the error message', async () => {
        const {registered} = await addControl(tool(() => {
            throw new Error('No such layer.');
        }));
        expect(await registered.get('test')!.execute({})).toEqual({type: 'error', error: {message: 'No such layer.'}});
    });

    test('each further map on the page gets its tools with its number after the name', async () => {
        const first = await addControl({camera});
        const second = await addControl({camera}, undefined, first.registered);
        await second.run('camera_2', {action: 'jumpTo', zoom: 5});
        expect({names: [...first.registered.keys()], zooms: [first.map.getZoom(), second.map.getZoom()]}).toEqual({names: ['camera', 'camera_2'], zooms: [3, 5]});
    });

    test('without a WebMCP API the control warns once with what to do', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        onTestFinished(() => warn.mockRestore());
        const {map} = await addControl({});
        Reflect.deleteProperty(document, 'modelContext');
        map.addControl(new MapboxWebMCP({mapboxgl, tools: {camera}}));
        map.addControl(new MapboxWebMCP({mapboxgl, tools: {marker}}));
        expect(warn.mock.calls).toEqual([['MapboxWebMCP registered no tools, because this browser has no WebMCP API. In Chrome, add a WebMCP origin trial token to the page, or turn on chrome://flags/#enable-webmcp-testing to test locally.']]);
    });

    test('removing the control unregisters its tools', async () => {
        const {map, control, registered} = await addControl(tool(() => null));
        map.removeControl(control);
        expect(registered.size).toBe(0);
    });
});

test('a tool gets input that fails its schema back as an error naming the field', async () => {
    const execute = vi.fn();
    const {registered} = await addControl(tool(execute));
    expect({result: await registered.get('test')!.execute({a: 'x'}), calls: execute.mock.calls.length}).toEqual({
        result: {type: 'error', error: {message: 'a: expected number, received string'}}, calls: 0
    });
});

test.each([
    {email: {type: 'string', pattern: '@'}, message: 'notify.email: unsupported schema keyword "pattern"'},
    {email: {type: 'string', default: 1}, message: 'notify.email: expected string, received number'}
] as const)('a custom tool whose schema has $email throws on construction', ({email, message}) => {
    const inputSchema = {type: 'object', properties: {email}} as const;
    expect(() => new MapboxWebMCP({mapboxgl, tools: {notify: {description: 'Test', inputSchema, execute: () => null}}})).toThrow(message);
});

test('a custom tool whose schema is not an object type throws on construction', () => {
    const inputSchema = {type: 'string'} as unknown as ObjectSchema;
    expect(() => new MapboxWebMCP({mapboxgl, tools: {notify: {description: 'Test', inputSchema, execute: () => null}}})).toThrow('notify: expected type "object"');
});

test.each([
    {inputSchema: {type: 'object', additionalProperties: false}, input: {foo: 1}, message: 'foo: unknown field'},
    {inputSchema: {type: 'object', required: ['constructor']}, input: {}, message: 'constructor: missing'}
] as const)('a tool whose schema has no properties refuses $input', async ({inputSchema, input, message}) => {
    const {registered} = await addControl({test: {description: 'Test', inputSchema, execute: () => null}});
    expect(await registered.get('test')!.execute(input)).toEqual({type: 'error', error: {message}});
});

test('a tool that changes a default input value gets the original default on the next call', async () => {
    const inputSchema = {type: 'object', properties: {tags: {type: 'array', items: {type: 'string'}, default: []}}} as const;
    const tagger: MapboxWebMCPTool<typeof inputSchema> = {description: 'Test', inputSchema, execute: ({tags}) => tags.push('x')};
    const {run} = await addControl({tagger});
    await run('tagger', {});
    expect(await run('tagger', {})).toBe(1);
});

test('a default object gets its own fields\' defaults', async () => {
    const inputSchema = {type: 'object', properties: {opts: {type: 'object', properties: {a: {type: 'number', default: 1}}, required: ['a'], default: {}}}} as const;
    const echo: MapboxWebMCPTool<typeof inputSchema> = {description: 'Test', inputSchema, execute: (input) => input};
    const {run} = await addControl({echo});
    expect(await run('echo', {})).toEqual({opts: {a: 1}});
});

test('each built-in tool refuses an action its schema does not list', async () => {
    const {registered} = await addControl(tools);
    const results = await Promise.all(Object.keys(tools).map((name) => registered.get(name)!.execute({action: 'toString'})));
    expect(results).toEqual(Object.values(tools).map(({inputSchema}) => {
        const actions = inputSchema.properties.action.enum.map((action) => JSON.stringify(action));
        return {type: 'error', error: {message: `action: expected one of ${actions.join(', ')}`}};
    }));
});

const highlightPaint: mapboxgl.CirclePaint = {'circle-color': ['case', ['boolean', ['feature-state', 'highlight'], false], 'red', 'black']};

const loaded = (map: mapboxgl.Map) => new Promise((resolve) => {
    map.once('idle', resolve);
    map.triggerRepaint();
});

describe.each([
    {options: {}},
    {options: {generateId: true}},
    {options: {promoteId: 'pid'}}
])('on a GeoJSON source with $options', ({options}) => {
    async function addPoints() {
        const {map, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
        const point = (id: number, name: string, lng: number) => ({type: 'Feature' as const, id, properties: {name, pid: id + 1000}, geometry: {type: 'Point' as const, coordinates: [lng, 0]}});
        map.addSource('s', {type: 'geojson', ...options, data: {type: 'FeatureCollection', features: [point(100, 'a', -10), point(101, 'b', 10)]}});
        map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
        await map.once('idle');
        const drawn = () => map.queryRenderedFeatures({layers: ['l']}).map((f) => ({name: f.properties!.name as string, state: f.state})).sort((x, y) => x.name.localeCompare(y.name));
        return {registered, drawn};
    }

    test('set with a filter shows only the matching features', async () => {
        const {registered, drawn} = await addPoints();
        await registered.get('layer')!.execute({action: 'set', layerId: 'l', filter: ['==', ['get', 'name'], 'b']});
        expect(drawn().map((f) => f.name)).toEqual(['b']);
    });

    test('setFeatureState sets the feature state on the given features', async () => {
        const {registered, drawn} = await addPoints();
        const {value} = await registered.get('feature')!.execute({action: 'query', target: {layerId: 'l'}, filter: ['==', ['get', 'name'], 'b']}) as unknown as {value: {features: {id: string | number}[]}};
        await registered.get('feature')!.execute({action: 'setFeatureState', target: {layerId: 'l'}, ids: [value.features[0].id], state: {highlight: true}});
        expect(drawn()).toEqual([{name: 'a', state: {}}, {name: 'b', state: {highlight: true}}]);
    });
});

test('setFeatureState sets the feature state on a clustered source, as GL JS does', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 100, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
    await loaded(map);
    expect(await run('feature', {action: 'setFeatureState', target: {layerId: 'l'}, ids: [100], state: {highlight: true}})).toMatchObject({
        target: {layerId: 'l'}, features: [{id: 100, state: {highlight: true}}]
    });
});

test('feature query within keeps a cluster, also when a feature outside the polygon has its id', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
        {type: 'Feature', id: 2, properties: {}, geometry: {type: 'Point', coordinates: [0.001, 0]}},
        {type: 'Feature', id: 19, properties: {}, geometry: {type: 'Point', coordinates: [40, 40]}}
    ]}});
    map.addSource('areas', {type: 'geojson', data: {type: 'Feature', id: 9, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]}}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    map.addLayer({id: 'areas', type: 'fill', source: 'areas'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}, within: {target: {layerId: 'areas'}, id: 9}}) as {features: {id: unknown}[]};
    expect(features.map((f) => f.id)).toEqual([19]);
});

test('set with a filter sets a filter on a layer of a clustered source, as GL JS does', async () => {
    const {map, registered} = await addControl(tools);
    map.addSource('s', {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 100, properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    const {type} = await registered.get('layer')!.execute({action: 'set', layerId: 'l', filter: ['==', ['get', 'name'], 'a']});
    expect({type, filter: (map.getFilter('l') as unknown[])[2]}).toEqual({type: 'success', filter: ['==', ['get', 'name'], 'a']});
});

test.each([
    {options: {dynamic: true}},
    {options: {filter: ['==', ['get', 'name'], 'a']}}
])('feature query returns the features of a source with $options', async ({options}) => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', ...options, data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 100, properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown}[]};
    expect(features.map((f) => f.id)).toEqual([100]);
});

async function addStatePoints() {
    const {map, run, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [100, 101, 102, 103].map((id, i) => (
        {type: 'Feature' as const, id, properties: {}, geometry: {type: 'Point' as const, coordinates: [i, 10]}}
    ))}});
    map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
    await loaded(map);
    const states = () => [100, 101, 102, 103].map((id) => map.getFeatureState({source: 's', id}));
    return {map, run, registered, states};
}

test('setFeatureState changes only the given features, and query returns the feature states', async () => {
    const {map, run, states} = await addStatePoints();
    map.setFeatureState({source: 's', id: 101}, {highlight: true});
    await run('feature', {action: 'setFeatureState', target: {layerId: 'l'}, ids: [100], state: {highlight: true}});
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown; state?: object}[]};
    expect({states: states(), query: features.map((f) => [f.id, f.state])}).toEqual({
        states: [{highlight: true}, {highlight: true}, {}, {}],
        query: [[100, {highlight: true}], [101, {highlight: true}], [102, {}], [103, {}]]
    });
});

test.each([
    {input: {ids: [100], state: {selected: true}}, message: 'The feature state "selected" isn\'t read by layer "l", so it wouldn\'t show. It reads "highlight".'},
    {input: {ids: [], state: {highlight: true}}, message: 'Give the ids of the features to change. Query the target to see them.'}
])('setFeatureState refuses $input and changes nothing', async ({input, message}) => {
    const {map, registered, states} = await addStatePoints();
    map.setFeatureState({source: 's', id: 101}, {highlight: true});
    expect({result: await registered.get('feature')!.execute({action: 'setFeatureState', target: {layerId: 'l'}, ...input}), states: states()}).toEqual({
        result: {type: 'error', error: {message}}, states: [{}, {highlight: true}, {}, {}]
    });
});

test('removeFeatureState with a key removes only that key from the given ids, also a key that the app set', async () => {
    const {map, run, states} = await addStatePoints();
    map.setPaintProperty('l', 'circle-radius', ['case', ['boolean', ['feature-state', 'selected'], false], 10, 5]);
    for (const id of [100, 101]) map.setFeatureState({source: 's', id}, {highlight: true, selected: true});
    const result = await run('feature', {action: 'removeFeatureState', target: {layerId: 'l'}, ids: [100], key: 'highlight'});
    expect({result, states: states()}).toEqual({
        result: {target: {layerId: 'l'}, features: [{id: 100, state: {selected: true}}]},
        states: [{selected: true}, {highlight: true, selected: true}, {}, {}]
    });
});

test('removeFeatureState without a key removes every key that the target reads from the given ids, and keeps the other keys', async () => {
    const {map, run, states} = await addStatePoints();
    for (const id of [100, 101]) map.setFeatureState({source: 's', id}, {highlight: true, other: 1});
    await run('feature', {action: 'removeFeatureState', target: {layerId: 'l'}, ids: [100]});
    expect(states()).toEqual([{other: 1}, {highlight: true, other: 1}, {}, {}]);
});

test('removeFeatureState refuses a key that the layer does not read, and changes nothing', async () => {
    const {map, registered, states} = await addStatePoints();
    map.setFeatureState({source: 's', id: 100}, {highlight: true, selected: true});
    expect({result: await registered.get('feature')!.execute({action: 'removeFeatureState', target: {layerId: 'l'}, ids: [100], key: 'selected'}), states: states()}).toEqual({
        result: {type: 'error', error: {message: 'The feature state "selected" isn\'t read by layer "l", so it wouldn\'t show. It reads "highlight".'}}, states: [{highlight: true, selected: true}, {}, {}, {}]
    });
});

const drawnStates = (map: mapboxgl.Map, layer: string) => Object.fromEntries(map.queryRenderedFeatures({layers: [layer]}).map((f) => [f.properties!.name as string, f.state]));

test('the style read returns the feature-state keys that paint and appearances read, and setFeatureState refuses a layer that reads none', async () => {
    const {map, run, registered} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'Feature', id: 100, properties: {}, geometry: {type: 'Point', coordinates: [0, 10]}}});
    map.addLayer({id: 'plain', type: 'circle', source: 's', paint: {'circle-color': ['case', ['in', 'x', ['literal', ['feature-state', 'hidden']]], 'red', 'black']}});
    map.addLayer({id: 'styled', type: 'circle', source: 's', paint: highlightPaint});
    map.addLayer({id: 'appears', type: 'symbol', source: 's', appearances: [{condition: ['boolean', ['feature-state', 'hover'], false], properties: {'icon-size': 2}}]});
    await loaded(map);
    const list = (await run('style', {action: 'get'})).targets as {target: object; featureStateKeys?: string[]}[];
    expect({
        list: list.map(({target, featureStateKeys}) => [target, featureStateKeys]),
        state: await registered.get('feature')!.execute({action: 'setFeatureState', target: {layerId: 'plain'}, ids: [100], state: {highlight: true}}),
        stored: map.getFeatureState({source: 's', id: 100})
    }).toEqual({
        list: [[{layerId: 'plain'}, undefined], [{layerId: 'styled'}, ['highlight']], [{layerId: 'appears'}, ['hover']]],
        state: {type: 'error', error: {message: 'The feature state "highlight" isn\'t read by layer "plain", so it wouldn\'t show. It reads no feature state.'}},
        stored: {}
    });
});

test('feature query returns a feature without an id once per copy GL JS returns', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'Feature', properties: {name: 'road'}, geometry: {type: 'LineString', coordinates: [[-10, 10], [10, 10]]}}});
    map.addLayer({id: 'l', type: 'line', source: 's', paint: {'line-color': ['case', ['boolean', ['feature-state', 'highlight'], false], 'red', 'black']}});
    await loaded(map);
    const {total, features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {total: number; features: {id: string | null}[]};
    expect({total, ids: features.map((f) => f.id)}).toEqual({total: 4, ids: [null, null, null, null]});
});

test('feature query returns each copy GL JS returns for a feature with an id, and total counts them', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'Feature', id: 5, properties: {}, geometry: {type: 'LineString', coordinates: [[-10, 10], [10, 10]]}}});
    map.addLayer({id: 'l', type: 'line', source: 's'});
    await loaded(map);
    const {total, features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {total: number; features: {id: number}[]};
    expect({total, ids: features.map((f) => f.id)}).toEqual({total: 4, ids: [5, 5, 5, 5]});
});

test('feature query returns features that share an id with their own properties, and setFeatureState and fitBounds on that id act on all of them', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: ['a', 'b'].map((name, i) => (
        {type: 'Feature' as const, id: 7, properties: {name}, geometry: {type: 'Point' as const, coordinates: [i * 20 - 10, 10]}}
    ))}});
    map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown; properties: object}[]};
    await run('feature', {action: 'setFeatureState', target: {layerId: 'l'}, ids: [7], state: {highlight: true}});
    await run('camera', {action: 'fitBounds', features: [{target: {layerId: 'l'}, id: 7}]});
    expect({features: features.map((f) => [f.id, f.properties]), drawn: drawnStates(map, 'l'), framed: [withinOnePixelOfScreen(map, [-10, 10]), withinOnePixelOfScreen(map, [10, 10])]}).toEqual({
        features: [[7, {name: 'a'}], [7, {name: 'b'}]],
        drawn: {a: {highlight: true}, b: {highlight: true}},
        framed: [true, true]
    });
});

test('feature query keeps the type of each id, and setFeatureState on 1 also changes "1" on another layer, which GL JS gives the same feature state', async () => {
    const {map, run, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', promoteId: 'key', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', properties: {name: 'a', key: 1}, geometry: {type: 'Point', coordinates: [0, 10]}},
        {type: 'Feature', properties: {name: 'b', key: '1'}, geometry: {type: 'Point', coordinates: [1, 10]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
    map.addLayer({id: 'la', type: 'circle', source: 's', filter: ['==', ['get', 'name'], 'a'], paint: highlightPaint});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown; properties: {name: string}}[]};
    const state = await registered.get('feature')!.execute({action: 'setFeatureState', target: {layerId: 'la'}, ids: [1], state: {highlight: true}});
    expect({ids: features.map((f) => [f.properties.name, f.id]), state, drawn: drawnStates(map, 'l')}).toEqual({
        ids: [['a', 1], ['b', '1']],
        state: {type: 'success', value: {target: {layerId: 'la'}, features: [{id: 1, state: {highlight: true}}]}},
        drawn: {a: {highlight: true}, b: {highlight: true}}
    });
});

test('set with filter null removes its filter after the app replaces the data', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 100, properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await run('layer', {action: 'set', layerId: 'l', filter: ['==', ['get', 'name'], 'a']});
    map.getSource<mapboxgl.GeoJSONSource>('s')!.setData({type: 'FeatureCollection', features: [
        {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]});
    expect(await run('layer', {action: 'set', layerId: 'l', filter: null})).toEqual({layerId: 'l', filter: null, matched: 4});
});

async function addPlaces() {
    const {map, control, run, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
    const place = (id: number, name: string, rating: number, lng: number) => ({type: 'Feature' as const, id, properties: {name, rating}, geometry: {type: 'Point' as const, coordinates: [lng, 0]}});
    map.addSource('places', {type: 'geojson', data: {type: 'FeatureCollection', features: [place(1, 'a', 3, -10), place(2, 'b', 5, 0), place(3, 'c', 4, 10)]}});
    map.addLayer({id: 'places', type: 'circle', source: 'places'});
    map.addSource('areas', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-15, -5], [5, -5], [5, 5], [-15, 5], [-15, -5]]]}}
    ]}});
    map.addLayer({id: 'areas', type: 'fill', source: 'areas'});
    await map.once('idle');
    return {map, control, run, registered};
}

test('camera jumpTo moves the camera and get reads it back', async () => {
    const {run} = await addPlaces();
    await run('camera', {action: 'jumpTo', center: {lng: 10, lat: 20}, zoom: 5, bearing: 30, pitch: 40});
    expect(await run('camera', {action: 'get'})).toEqual({center: {lng: 10, lat: 20}, zoom: 5, bearing: 30, pitch: 40});
});

test.each([
    {input: {zoom: 'x'}, message: 'zoom: expected number, received string'},
    {input: {center: {lng: Infinity, lat: 0}}, message: 'center.lng: expected number, received Infinity'},
    {input: {zoom: 8, center: {lng: 0, lat: 100}}, message: 'Invalid LngLat latitude value: must be between -90 and 90'}
])('camera jumpTo with $input refuses it and keeps the camera', async ({input, message}) => {
    const {map, registered} = await addControl(tools);
    const result = await registered.get('camera')!.execute({action: 'jumpTo', ...input});
    const {lng, lat} = map.getCenter();
    expect({result, camera: [lng, lat, map.getZoom()]}).toEqual({result: {type: 'error', error: {message}}, camera: [0, 0, 3]});
});

test('a tool keeps its change and adds a note when the map does not finish rendering in 5 seconds', async () => {
    const {map, registered} = await addControl({camera});
    map.repaint = true;
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    onTestFinished(() => {
        vi.useRealTimers();
        map.repaint = false;
    });
    const result = registered.get('camera')!.execute({action: 'jumpTo', zoom: 5});
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual({type: 'success', value: {
        center: {lng: 0, lat: 0}, zoom: 5, bearing: 0, pitch: 0,
        note: 'The map did not finish rendering in 5000 ms, so it can still be loading tiles. Read the map again to see its state.'
    }});
});

test('a 3 second camera flyTo resolves after moveend and idle, with no note', async () => {
    const {map, registered} = await addControl({camera});
    const start = performance.now();
    const result = await registered.get('camera')!.execute({action: 'flyTo', center: {lng: 10, lat: 10}, zoom: 5, duration: 3000});
    expect({result, waited: performance.now() - start >= 3000, moving: map.isMoving(), loaded: map.loaded()}).toEqual({
        result: {type: 'success', value: {center: {lng: expect.closeTo(10, 9) as unknown, lat: expect.closeTo(10, 9) as unknown}, zoom: 5, bearing: 0, pitch: 0}}, waited: true, moving: false, loaded: true
    });
});

test('camera easeTo gives the animation options to GL JS and resolves after the move ends', async () => {
    const {map, run} = await addControl({camera});
    const moveends: unknown[] = [];
    map.on('moveend', () => moveends.push(map.getZoom()));
    const moved = await run('camera', {action: 'easeTo', zoom: 5, bearing: 90, duration: 200, offset: [0, 0]});
    expect({moved, moveends}).toEqual({moved: {center: {lng: expect.closeTo(0, 9) as unknown, lat: expect.closeTo(0, 9) as unknown}, zoom: 5, bearing: 90, pitch: 0}, moveends: [5]});
});

test('a camera call ends when the app removes the map during the move', async () => {
    const {map, registered} = await addControl({camera});
    const result = registered.get('camera')!.execute({action: 'flyTo', zoom: 5, duration: 3000});
    await map.once('move');
    map.remove();
    expect(await result).toMatchObject({type: 'success'});
});

test('camera jumpTo takes the zoom range of the map', async () => {
    const {run} = await addControl(tools, undefined, undefined, {maxZoom: 24});
    await run('camera', {action: 'jumpTo', zoom: 23});
    expect((await run('camera', {action: 'get'})).zoom).toBe(23);
});

const withinOnePixelOfScreen = (map: mapboxgl.Map, p: [number, number]) => {
    const {clientWidth, clientHeight} = map.getContainer();
    const {x, y} = map.project(p);
    return x >= -1 && x <= clientWidth + 1 && y >= -1 && y <= clientHeight + 1;
};

test('camera fitBounds shows the given features and LngLats', async () => {
    const {map, run} = await addPlaces();
    await run('camera', {action: 'fitBounds', features: [{target: {layerId: 'places'}, id: 1}], lngLats: [{lng: 20, lat: 10}]});
    expect([withinOnePixelOfScreen(map, [-10, 0]), withinOnePixelOfScreen(map, [20, 10]), withinOnePixelOfScreen(map, [60, 0])]).toEqual([true, true, false]);
});

const fitted = async (map: mapboxgl.Map, run: Awaited<ReturnType<typeof addControl>>['run'], points: [number, number][], drawnAt = points) => {
    const {center: {lng, lat}, zoom} = await run('camera', {action: 'fitBounds', lngLats: points.map(([lng, lat]) => ({lng, lat}))}) as {center: {lng: number; lat: number}; zoom: number};
    return {center: [lng, lat].map((v) => +v.toFixed(2)), zoom: +zoom.toFixed(2), x: drawnAt.map((p) => Math.round(map.project(p).x))};
};

test('camera fitBounds on one LngLat zooms to the map\'s maximum zoom', async () => {
    const {map, run} = await addControl(tools);
    expect(await fitted(map, run, [[10, 10]])).toEqual({center: [10, 10], zoom: map.getMaxZoom(), x: [200]});
});

test('camera fitBounds takes a longitude outside -180 to 180 as given, as GL JS does', async () => {
    const {map, run} = await addControl(tools);
    expect(await fitted(map, run, [[170, 0], [190, 0]])).toEqual({center: [180, 0], zoom: 3.81, x: [0, 400]});
});

test('camera fitBounds keeps the given padding around the LngLats', async () => {
    const {map, run} = await addControl(tools);
    await run('camera', {action: 'fitBounds', lngLats: [{lng: 10, lat: 10}, {lng: 20, lat: 20}], padding: {left: 100, top: 0, right: 0, bottom: 0}, linear: true, duration: 100});
    expect([10, 20].map((lng) => Math.round(map.project([lng, 15]).x))).toEqual([100, 400]);
});

test('camera fitBounds keeps the LngLats out of the app padding', async () => {
    const {map, run} = await addControl(tools);
    map.setPadding({left: 200, top: 0, right: 0, bottom: 0});
    expect(await fitted(map, run, [[10, 10], [20, 20]])).toEqual({center: [15, 15.06], zoom: 3.81, x: [200, 400]});
});

test('camera fitBounds without bearing and pitch sets both to 0, as GL JS does', async () => {
    const {run} = await addControl(tools);
    await run('camera', {action: 'jumpTo', bearing: 30, pitch: 40});
    const {bearing, pitch} = await run('camera', {action: 'fitBounds', lngLats: [{lng: 10, lat: 10}, {lng: 20, lat: 20}], animate: false});
    expect({bearing, pitch}).toEqual({bearing: 0, pitch: 0});
});

test('camera fitBounds keeps the given bearing and pitch', async () => {
    const {run} = await addControl(tools);
    await run('camera', {action: 'jumpTo', bearing: 30, pitch: 40});
    const {bearing, pitch} = await run('camera', {action: 'fitBounds', lngLats: [{lng: 10, lat: 10}, {lng: 20, lat: 20}], bearing: 30, pitch: 40, animate: false});
    expect({bearing, pitch}).toEqual({bearing: 30, pitch: 40});
});

test('feature list returns each layer with the names of the properties that its features have', async () => {
    const {run} = await addPlaces();
    expect(await run('feature', {action: 'list'})).toEqual([
        {target: {layerId: 'places'}, featureProperties: ['name', 'rating']},
        {target: {layerId: 'areas'}, featureProperties: []}
    ]);
});

test('feature list returns the property names of a featureset and no values', async () => {
    const {map, run} = await addControl(tools, {
        version: 8,
        sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: [
            {type: 'Feature', id: 7, properties: {name: 'c', kind: 'x'}, geometry: {type: 'Point', coordinates: [5, 10]}},
            {type: 'Feature', id: 8, properties: {name: 'd', kind: 'y'}, geometry: {type: 'Point', coordinates: [6, 10]}}
        ]}}},
        layers: [{id: 'poi', type: 'circle', source: 'pois'}],
        featuresets: {poi: {selectors: [{layer: 'poi', properties: {name: ['get', 'name']}}]}}
    }, undefined, {zoom: 0});
    await loaded(map);
    expect(await run('feature', {action: 'list'})).toEqual([
        {target: {layerId: 'poi'}, featureProperties: ['name', 'kind']},
        {target: {featuresetId: 'poi'}, featureProperties: ['name']}
    ]);
});

test('feature list returns only the target and the GL JS error for a layer whose filter GL JS can\'t evaluate off screen, and a layer without a source with no features', async () => {
    const {map, run} = await addPlaces();
    map.addLayer({id: 'labels', type: 'symbol', source: 'places', filter: ['>', ['pitch'], 30]});
    map.addLayer({id: 'sky', type: 'background'});
    expect(await run('feature', {action: 'list'})).toEqual([
        {target: {layerId: 'places'}, featureProperties: ['name', 'rating']},
        {target: {layerId: 'areas'}, featureProperties: []},
        {target: {layerId: 'labels'}, error: expect.any(String) as string},
        {target: {layerId: 'sky'}, featureProperties: []}
    ]);
});

test('feature list returns the target and the GL JS error of a failed read, also when properties leaves out error', async () => {
    const {map, run} = await addPlaces();
    map.addLayer({id: 'labels', type: 'symbol', source: 'places', filter: ['>', ['pitch'], 30]});
    expect((await run('feature', {action: 'list', properties: ['featureProperties']}) as unknown as object[]).at(-1)).toEqual({target: {layerId: 'labels'}, error: expect.any(String) as string});
});

test('feature list returns only the keys of properties', async () => {
    const {run} = await addPlaces();
    expect(await run('feature', {action: 'list', properties: ['target']})).toEqual([{target: {layerId: 'places'}}, {target: {layerId: 'areas'}}]);
});

test('feature query without a target refuses the call and points to list', async () => {
    const {registered} = await addPlaces();
    expect(await registered.get('feature')!.execute({action: 'query', limit: 1})).toEqual({
        type: 'error', error: {message: 'Give a target. Run the feature tool with the action "list" to see the targets.'}
    });
});

test('layer, source, marker and popup list take no limit', async () => {
    const {registered} = await addPlaces();
    const refused = await Promise.all(['layer', 'source', 'marker', 'popup'].map((name) => registered.get(name)!.execute({action: 'list', limit: 1})));
    expect(refused.map((result) => result.type)).toEqual(['error', 'error', 'error', 'error']);
});

test('feature query returns only the properties in featureProperties, and null for a name that the feature lacks', async () => {
    const {run} = await addPlaces();
    const {features} = await run('feature', {action: 'query', target: {layerId: 'places'}, filter: ['==', ['get', 'name'], 'b'], featureProperties: ['name', 'missing']}) as {features: {properties: object}[]};
    expect(features.map((f) => f.properties)).toEqual([{name: 'b', missing: null}]);
});

test('set with a filter on a layer without a source returns the GL JS error of a filter that GL JS refuses, and leaves the layer without a filter', async () => {
    const {map, registered} = await addPlaces();
    map.addLayer({id: 'sky', type: 'background'});
    expect({result: await registered.get('layer')!.execute({action: 'set', layerId: 'sky', filter: ['==', ['get', 'rating']]}), filter: map.getFilter('sky')}).toEqual({
        result: {type: 'error', error: {message: expect.stringContaining('Expected two or three arguments.') as string}}, filter: undefined
    });
});

test.each([
    {input: {filter: ['>', ['get', 'rating'], 3]}, names: ['b', 'c'], total: 2},
    {input: {distance: {lngLat: {lng: 0, lat: 0}, meters: 500000}}, names: ['b'], total: 1},
    {input: {within: {target: {layerId: 'areas'}, id: 1}}, names: ['a', 'b'], total: 2},
    {input: {sort: {property: 'rating', order: 'desc'}, limit: 2}, names: ['b', 'c'], total: 3}
])('feature query with $input', async ({input, names, total}) => {
    const {run} = await addPlaces();
    const value = await run('feature', {action: 'query', target: {layerId: 'places'}, ...input}) as {features: {properties: {name: string}}[]; total: number};
    expect({names: value.features.map((f) => f.properties.name), total: value.total}).toEqual({names, total});
});

test('feature query matches text inside a property, and within refuses a feature that is not a polygon', async () => {
    const {map, run, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 2, properties: {name: 'b', tags: 'bakery, cafe'}, geometry: {type: 'Point', coordinates: [0, 10]}},
        {type: 'Feature', id: 3, properties: {name: 'c', tags: 'bar'}, geometry: {type: 'Point', coordinates: [1, 10]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const value = await run('feature', {action: 'query', target: {layerId: 'l'}, filter: ['in', 'cafe', ['get', 'tags']]}) as {features: {properties: {name: string}}[]};
    const inside = await registered.get('feature')!.execute({action: 'query', target: {layerId: 'l'}, within: {target: {layerId: 'l'}, id: 3}});
    expect({names: value.features.map((f) => f.properties.name), inside}).toEqual({
        names: ['b'], inside: {type: 'error', error: {message: '"within" needs a polygon feature, and feature 3 of layer "l" is a Point.'}}
    });
});

test.each([
    {filter: ['==', ['get', 'rating']], message: 'filter: layers.places.filter[2]: Expected two or three arguments.'},
    {filter: {property: 'rating', op: 'eq', value: '5'}, message: 'filter: expected array or null, received object'}
])('set refuses filter $filter and keeps the filter on', async ({filter: refused, message}) => {
    const {map, run, registered} = await addPlaces();
    await run('layer', {action: 'set', layerId: 'places', filter: ['==', ['get', 'name'], 'a']});
    const filter = map.getFilter('places');
    const result = await registered.get('layer')!.execute({action: 'set', layerId: 'places', filter: refused});
    expect({result, filter: map.getFilter('places')}).toEqual({result: {type: 'error', error: {message}}, filter});
});

test('a new set with a filter replaces the tool\'s filter before and counts what it shows', async () => {
    const {run} = await addPlaces();
    await run('layer', {action: 'set', layerId: 'places', filter: ['==', ['get', 'name'], 'a']});
    expect(await run('layer', {action: 'set', layerId: 'places', filter: ['>=', ['get', 'rating'], 4]})).toEqual({layerId: 'places', filter: ['>=', ['get', 'rating'], 4], matched: 2});
});

test('set with a filter sets a filter that GL JS can\'t evaluate off screen, and returns the GL JS error in place of the count', async () => {
    const {map, run} = await addPlaces();
    map.addLayer({id: 'labels', type: 'symbol', source: 'places'});
    const result = await run('layer', {action: 'set', layerId: 'labels', filter: ['>', ['pitch'], 30]});
    expect({result, filter: map.getFilter('labels')}).toEqual({
        result: {layerId: 'labels', filter: ['>', ['pitch'], 30], error: expect.any(String) as string},
        filter: ['all', ['to-boolean', 'mapbox-webmcp-filter'], ['>', ['pitch'], 30]]
    });
});

test('query refuses a filter that GL JS can\'t evaluate', async () => {
    const {registered} = await addPlaces();
    expect(await registered.get('feature')!.execute({action: 'query', target: {layerId: 'places'}, filter: ['==', ['get', 'rating']]})).toEqual({
        type: 'error', error: {message: 'querySourceFeatures.filter: Expected two or three arguments.'}
    });
});

test('set with a filter combines with an app filter and counts the features that match both, which query returns', async () => {
    const {map, run} = await addPlaces();
    map.setFilter('places', ['>=', ['get', 'rating'], 4]);
    expect(await run('layer', {action: 'set', layerId: 'places', filter: ['!=', ['get', 'name'], 'b']})).toEqual({layerId: 'places', filter: ['!=', ['get', 'name'], 'b'], matched: 1});
    expect((await run('feature', {action: 'query', target: {layerId: 'places'}})).features).toMatchObject([{id: 3}]);
});

test('set with a filter clears to the app filter after the app replaces the control', async () => {
    const {map, control, run} = await addPlaces();
    map.setFilter('places', ['>=', ['get', 'rating'], 4]);
    await run('layer', {action: 'set', layerId: 'places', filter: ['!=', ['get', 'name'], 'b']});
    map.removeControl(control);
    map.addControl(new MapboxWebMCP({mapboxgl, tools}));
    await run('layer', {action: 'set', layerId: 'places', filter: null});
    expect(map.getFilter('places')).toEqual(['>=', ['get', 'rating'], 4]);
});

test('set with a filter keeps an app filter of false and clears back to it', async () => {
    const {map, run} = await addPlaces();
    map.setFilter('places', false as unknown as FilterSpecification);
    expect(await run('layer', {action: 'set', layerId: 'places', filter: ['!=', ['get', 'name'], 'b']})).toEqual({layerId: 'places', filter: ['!=', ['get', 'name'], 'b'], matched: 0});
    await run('layer', {action: 'set', layerId: 'places', filter: null});
    expect(map.getFilter('places')).toBe(false);
});

test('set with filter null returns how many features the layer shows', async () => {
    const {map, run} = await addPlaces();
    map.setFilter('places', ['>=', ['get', 'rating'], 4]);
    await run('layer', {action: 'set', layerId: 'places', filter: ['==', ['get', 'name'], 'b']});
    expect(await run('layer', {action: 'set', layerId: 'places', filter: null})).toEqual({layerId: 'places', filter: null, matched: 2});
});

test('set with a filter refuses a layer whose app filter is in the legacy syntax, and keeps that filter', async () => {
    const {map, registered} = await addPlaces();
    map.setFilter('places', ['>=', 'rating', 4]);
    const result = await registered.get('layer')!.execute({action: 'set', layerId: 'places', filter: ['!=', ['get', 'name'], 'b']});
    expect({result, filter: map.getFilter('places')}).toEqual({
        result: {type: 'error', error: {message: 'filter: layers.places.filter[1][0]: expected one of [==, !=, >, >=, <, <=, in, !in, all, any, none, has, !has], "to-boolean" found'}},
        filter: ['>=', 'rating', 4]
    });
});

test('layer set sets layout and paint properties, resets one with null, and returns what GL JS reads back', async () => {
    const {map, run} = await addPlaces();
    map.addLayer({id: 'labels', type: 'symbol', source: 'places', layout: {'text-size': 10}});
    expect(await run('layer', {action: 'set', layerId: 'labels', layout: {'text-size': null, 'symbol-sort-key': ['get', 'rating']}, paint: {'text-opacity': 0.5}})).toEqual({
        layerId: 'labels', layout: {'text-size': null, 'symbol-sort-key': ['get', 'rating']}, paint: {'text-opacity': 0.5}
    });
});

test('layer set applies the other properties when GL JS refuses one, and returns the GL JS error', async () => {
    const {map, registered} = await addPlaces();
    const result = await registered.get('layer')!.execute({action: 'set', layerId: 'places', paint: {'circle-color': 'nope', 'circle-opacity': 0.5}});
    expect({result, opacity: map.getPaintProperty('places', 'circle-opacity')}).toEqual({
        result: {type: 'error', error: {message: 'circle-color: layers.places.paint.circle-color: color expected, "nope" found\nThe other parts changed. Get the layer to see it.'}}, opacity: 0.5
    });
});

test('the layer tool gets and sets a layer of an import, which style get names under its featureset', async () => {
    const {map, run, registered} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [{id: 'basemap', url: '', data: {
        version: 8,
        sources: {pois: {type: 'geojson', data: {type: 'Feature', id: 7, properties: {name: 'c'}, geometry: {type: 'Point', coordinates: [5, 10]}}}},
        layers: [{id: 'poi', type: 'circle', source: 'pois', filter: ['has', 'name']}],
        featuresets: {poi: {selectors: [{layer: 'poi', properties: {name: ['get', 'name']}}]}}
    }}]}, undefined, {zoom: 0});
    await loaded(map);
    const poi = {featuresetId: 'poi', importId: 'basemap'};
    const {targets} = await run('style', {action: 'get'});
    const got = await run('layer', {action: 'get', layerId: 'poi', importId: 'basemap'});
    const result = await registered.get('layer')!.execute({action: 'set', layerId: 'poi', importId: 'basemap', filter: ['!=', ['get', 'name'], 'c'], layout: {'circle-sort-key': 1}, paint: {'circle-color': 'nope'}});
    expect({targets, got, result, now: await run('layer', {action: 'get', layerId: 'poi', importId: 'basemap'})}).toEqual({
        targets: [{target: poi, layers: ['poi']}],
        got: {id: 'poi', type: 'circle', source: 'pois', filter: ['has', 'name']},
        result: {type: 'error', error: {message: expect.stringContaining('circle-color: ') as string}},
        now: {id: 'poi', type: 'circle', source: 'pois', filter: ['all', ['to-boolean', 'mapbox-webmcp-filter'], ['!=', ['get', 'name'], 'c'], ['has', 'name']], layout: {'circle-sort-key': 1}}
    });
});

test('layer list returns the layers of the root style or of an import by id, type, source and source-layer, or the keys in properties', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [{id: 'basemap', url: '', data: {
        version: 8,
        sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'background'}, {id: 'poi', type: 'circle', source: 'pois', paint: {'circle-radius': 3}}]
    }}]});
    await loaded(map);
    expect({
        imported: await run('layer', {action: 'list', importId: 'basemap'}),
        picked: await run('layer', {action: 'list', importId: 'basemap', properties: ['id', 'paint']}),
        root: await run('layer', {action: 'list'})
    }).toEqual({
        imported: [{id: 'land', type: 'background', source: null, 'source-layer': null}, {id: 'poi', type: 'circle', source: 'pois', 'source-layer': null}],
        picked: [{id: 'land', paint: null}, {id: 'poi', paint: {'circle-radius': 3}}],
        root: []
    });
});

test('layer tools read an empty import id as the root style', async () => {
    const {map, run} = await addControl(tools);
    map.addLayer({id: 'bg', type: 'background'});
    await loaded(map);
    await expect(run('layer', {action: 'get', layerId: 'nope', importId: ''})).rejects.toThrow('No layer "nope" in the root style.');
    expect(await run('layer', {action: 'list', importId: ''})).toEqual([{id: 'bg', type: 'background', source: null, 'source-layer': null}]);
});

test('the tools read GeoJSON by URL and featuresets of style imports through GL JS', async () => {
    const point = (name: string, lng: number, id?: number) => ({type: 'Feature', id, properties: {name}, geometry: {type: 'Point', coordinates: [lng, 10]}});
    const collection = (...features: object[]) => ({type: 'FeatureCollection', features});
    const {map, run} = await addControl(tools, {
        version: 8,
        sources: {url: {type: 'geojson', data: `data:application/json,${encodeURIComponent(JSON.stringify(collection(point('a', -10, 1), point('b', 10, 2))))}`}},
        layers: [{id: 'url', type: 'circle', source: 'url'}],
        imports: [{id: 'basemap', url: '', data: {
            version: 8,
            sources: {pois: {type: 'geojson', data: collection(point('c', 5, 7)) as GeoJSON.FeatureCollection}},
            layers: [{id: 'poi', type: 'circle', source: 'pois', paint: highlightPaint}],
            featuresets: {poi: {selectors: [{layer: 'poi', properties: {name: ['get', 'name']}}]}}
        }}]
    }, undefined, {zoom: 0});
    await loaded(map);
    const poi = {featuresetId: 'poi', importId: 'basemap'};
    const names = async (target: object) => ((await run('feature', {action: 'query', target})).features as {properties: {name: string}}[]).map((f) => f.properties.name);
    const list = (await run('style', {action: 'get'})).targets as {target: object; featureStateKeys?: string[]}[];
    expect(list.map(({target, featureStateKeys}) => [target, featureStateKeys])).toEqual([[{layerId: 'url'}, undefined], [poi, ['highlight']]]);
    expect([await names({layerId: 'url'}), await names(poi)]).toEqual([['a', 'b'], ['c']]);
    await run('feature', {action: 'setFeatureState', target: poi, ids: [7], state: {highlight: true}});
    expect(map.queryRenderedFeatures({target: {featuresetId: 'poi', importId: 'basemap'}})[0].state).toEqual({highlight: true});
});

test('the tools list, query and frame a featureset of the root style', async () => {
    const {map, run} = await addControl(tools, {
        version: 8,
        sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: [{type: 'Feature', id: 7, properties: {name: 'c'}, geometry: {type: 'Point', coordinates: [5, 10]}}]}}},
        layers: [{id: 'poi', type: 'circle', source: 'pois'}],
        featuresets: {poi: {selectors: [{layer: 'poi', properties: {name: ['get', 'name']}}]}}
    });
    await loaded(map);
    const list = ((await run('style', {action: 'get'})).targets as {target: object}[]).map((l) => l.target);
    const {features, query} = await run('feature', {action: 'query', target: {featuresetId: 'poi'}}) as {features: {id: unknown; properties: {name: string}}[]; query: string};
    const fit = await run('camera', {action: 'fitBounds', features: [{target: {featuresetId: 'poi'}, id: 7}, {target: {layerId: 'poi'}, id: 7}]}) as {center: {lng: number; lat: number}; query: string};
    expect({list, features: features.map((f) => [f.id, f.properties.name]), query, center: [fit.center.lng, fit.center.lat].map((v) => +v.toFixed(2)), fitQuery: fit.query}).toEqual({
        list: [{layerId: 'poi'}, {featuresetId: 'poi'}], features: [[7, 'c']], query: 'rendered', center: [5, 10], fitQuery: 'rendered and source'
    });
});

test('setFeatureState on a layer sets the feature state of a feature outside the loaded tiles, as GL JS does', async () => {
    const {map, registered} = await addControl(tools);
    map.jumpTo({center: [0, 0], zoom: 14});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 2, properties: {name: 'b'}, geometry: {type: 'Point', coordinates: [100, 40]}},
        {type: 'Feature', id: 3, properties: {name: 'b'}, geometry: {type: 'Point', coordinates: [0, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's', paint: highlightPaint});
    await loaded(map);
    expect({result: await registered.get('feature')!.execute({action: 'setFeatureState', target: {layerId: 'l'}, ids: [2], state: {highlight: true}}), state: map.getFeatureState({source: 's', id: 2})}).toEqual({
        result: {type: 'success', value: {target: {layerId: 'l'}, features: [{id: 2, state: {highlight: true}}]}}, state: {highlight: true}
    });
});

test('setFeatureState on a featureset sets the ids of rendered features, and returns an error that names each other id', async () => {
    const {map, registered} = await addControl(tools, {
        version: 8,
        sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: [{type: 'Feature', id: 7, properties: {}, geometry: {type: 'Point', coordinates: [5, 10]}}]}}},
        layers: [{id: 'poi', type: 'circle', source: 'pois', paint: highlightPaint}],
        featuresets: {poi: {selectors: [{layer: 'poi'}]}}
    });
    await loaded(map);
    expect({result: await registered.get('feature')!.execute({action: 'setFeatureState', target: {featuresetId: 'poi'}, ids: [999, 7], state: {highlight: true}}), state: map.getFeatureState({source: 'pois', id: 7})}).toEqual({
        result: {type: 'error', error: {message: 'id 999: No feature with id 999 in featureset "poi" of the root style.\nThe other ids changed. Query the features to see their feature state.'}},
        state: {highlight: true}
    });
});

test('feature query returns features without an id when GL JS has no id for their text ids', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 'a1', properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [-10, 10]}},
        {type: 'Feature', id: 'b1', properties: {name: 'b'}, geometry: {type: 'Point', coordinates: [10, 10]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: string | null; properties: {name: string}}[]};
    expect(features.map((f) => [f.properties.name, f.id])).toEqual(Array.from({length: 4}, () => [['a', null], ['b', null]]).flat());
});

test('feature query distance keeps points, lines and polygons within the distance', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 1, properties: {name: 'road'}, geometry: {type: 'LineString', coordinates: [[-1, 0.5], [3, 0.5]]}},
        {type: 'Feature', id: 2, properties: {name: 'park'}, geometry: {type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}},
        {type: 'Feature', id: 3, properties: {name: 'shop'}, geometry: {type: 'Point', coordinates: [5.5, 0.5]}}
    ]}});
    map.addLayer({id: 'l', type: 'line', source: 's'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}, distance: {lngLat: {lng: 0.5, lat: 1.5}, meters: 120000}, sort: {property: 'name', order: 'asc'}}) as {features: {properties: {name: string}}[]};
    expect(features.map((f) => f.properties.name)).toEqual(['park', 'road']);
});

test('feature query within keeps the points within a multipolygon, but not one in its hole, and keeps the line within', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 1, properties: {name: 'cafe'}, geometry: {type: 'Point', coordinates: [0.2, 0.2]}},
        {type: 'Feature', id: 2, properties: {name: 'pond'}, geometry: {type: 'Point', coordinates: [0.5, 0.5]}},
        {type: 'Feature', id: 3, properties: {name: 'shop'}, geometry: {type: 'Point', coordinates: [5.5, 0.5]}},
        {type: 'Feature', id: 4, properties: {name: 'farm'}, geometry: {type: 'Point', coordinates: [3, 0.5]}}
    ]}});
    map.addSource('lines', {type: 'geojson', data: {type: 'Feature', id: 5, properties: {}, geometry: {type: 'LineString', coordinates: [[0.1, 0.1], [0.2, 0.2]]}}});
    map.addSource('areas', {type: 'geojson', data: {type: 'Feature', id: 9, properties: {}, geometry: {type: 'MultiPolygon', coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]],
        [[[5, 0], [6, 0], [6, 1], [5, 1], [5, 0]]]
    ]}}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    map.addLayer({id: 'lines', type: 'line', source: 'lines'});
    map.addLayer({id: 'areas', type: 'fill', source: 'areas'});
    await loaded(map);
    const inside = await run('feature', {action: 'query', target: {layerId: 'l'}, within: {target: {layerId: 'areas'}, id: 9}}) as {features: {properties: {name: string}}[]};
    const lines = await run('feature', {action: 'query', target: {layerId: 'lines'}, within: {target: {layerId: 'areas'}, id: 9}}) as {features: {id: unknown}[]};
    expect({
        inside: [...new Set(inside.features.map((f) => f.properties.name))],
        lines: [...new Set(lines.features.map((f) => f.id))]
    }).toEqual({
        inside: ['cafe', 'shop'],
        lines: [5]
    });
});

test('feature query within keeps the point with id 1 within the polygon when a point with id "1" lies outside it', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', promoteId: 'key', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', properties: {name: 'in', key: 1}, geometry: {type: 'Point', coordinates: [0.5, 0.5]}},
        {type: 'Feature', properties: {name: 'out', key: '1'}, geometry: {type: 'Point', coordinates: [5, 5]}}
    ]}});
    map.addSource('areas', {type: 'geojson', data: {type: 'Feature', id: 9, properties: {}, geometry: {type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    map.addLayer({id: 'areas', type: 'fill', source: 'areas'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}, within: {target: {layerId: 'areas'}, id: 9}}) as {features: {id: unknown; properties: {name: string}}[]};
    expect(features.map((f) => [f.properties.name, f.id])).toEqual([['in', 1]]);
});

test('feature query sorts text as text, also when it looks like a number', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    const point = (id: number, pop: string) => ({type: 'Feature' as const, id, properties: {pop}, geometry: {type: 'Point' as const, coordinates: [0, 10]}});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [point(7, '9'), point(8, '100'), point(9, '10')]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}, sort: {property: 'pop', order: 'desc'}}) as {features: {id: unknown; properties: {pop: string}}[]};
    expect(features.map((f) => [f.properties.pop, f.id])).toEqual([['9', 7], ['100', 8], ['10', 9]]);
});

test('feature query refuses a limit that is not a whole number', async () => {
    const {registered} = await addPlaces();
    expect(await registered.get('feature')!.execute({action: 'query', target: {layerId: 'places'}, limit: 1.5})).toEqual({
        type: 'error', error: {message: 'limit: expected integer, received number'}
    });
});

test('feature query without a limit returns every feature', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: collection(...Array.from({length: 101}, (_, i) => point(i, i / 10)))});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const {total, features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {total: number; features: unknown[]};
    expect({total, shown: features.length}).toEqual({total: 101, shown: 101});
});

test('feature query with a limit returns the total before the limit', async () => {
    const {run} = await addPlaces();
    const {total, features} = await run('feature', {action: 'query', target: {layerId: 'places'}, limit: 1}) as {total: number; features: unknown[]};
    expect({total, shown: features.length}).toEqual({total: 3, shown: 1});
});

test('feature query keeps properties named like its own fields, and sorts and matches by them', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 3, properties: {id: 'B-1', lat: 'north'}, geometry: {type: 'Point', coordinates: [0, 0]}},
        {type: 'Feature', id: 4, properties: {id: 'A-7', lat: 'south'}, geometry: {type: 'Point', coordinates: [5.625, 0]}}
    ]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const sorted = await run('feature', {action: 'query', target: {layerId: 'l'}, sort: {property: 'id', order: 'asc'}});
    const matched = await run('feature', {action: 'query', target: {layerId: 'l'}, filter: ['==', ['get', 'id'], 'A-7']});
    expect({sorted, matched}).toEqual({
        sorted: {total: 2, query: 'source', features: [
            {id: 4, properties: {id: 'A-7', lat: 'south'}, state: {}},
            {id: 3, properties: {id: 'B-1', lat: 'north'}, state: {}}
        ]},
        matched: {total: 1, query: 'source', features: [{id: 4, properties: {id: 'A-7', lat: 'south'}, state: {}}]}
    });
});

test('feature query returns the geometry of a feature only when properties lists it, and null for a key that the feature lacks', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [{type: 'Feature', id: 3, properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [5.625, 0]}}]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}, properties: ['id', 'geometry', 'missing']}) as {features: unknown[]};
    expect(features).toEqual([{id: 3, geometry: {type: 'Point', coordinates: [5.625, 0]}, missing: null}]);
});

test('feature query at a LngLat returns only the rendered features under it, and with a filter only those that match', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    const place = (id: number, name: string, lng: number) => ({type: 'Feature' as const, id, properties: {name}, geometry: {type: 'Point' as const, coordinates: [lng, 0]}});
    map.addSource('s', {type: 'geojson', data: {type: 'FeatureCollection', features: [place(1, 'a', 0), place(2, 'b', 0), place(3, 'b', 40)]}});
    map.addLayer({id: 'l', type: 'circle', source: 's'});
    await loaded(map);
    const query = async (input: object) => {
        const {query: type, features} = await run('feature', {action: 'query', target: {layerId: 'l'}, lngLat: {lng: 0, lat: 0}, ...input}) as {query: string; features: {id: unknown}[]};
        return [type, features.map((f) => f.id).sort()];
    };
    expect([await query({}), await query({filter: ['==', ['get', 'name'], 'b']})]).toEqual([['rendered', [1, 2]], ['rendered', [2]]]);
});

const point = (id: number, lng: number) => ({type: 'Feature' as const, id, properties: {}, geometry: {type: 'Point' as const, coordinates: [lng, 0]}});
const collection = (...features: ReturnType<typeof point>[]) => ({type: 'FeatureCollection' as const, features});

test('source list returns the app\'s sources and the tool\'s sources with their types', async () => {
    const {run} = await addPlaces();
    await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: collection(point(1, 0))}});
    expect(await run('source', {action: 'list'})).toEqual([
        {id: 'places', type: 'geojson'}, {id: 'areas', type: 'geojson'}, {id: 'mapbox-webmcp-s', type: 'geojson'}
    ]);
});

test('source list returns the keys in properties of each source, also data, and source get returns one source in full', async () => {
    const {run} = await addPlaces();
    const data = collection(point(1, 0));
    await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data}});
    expect({
        picked: await run('source', {action: 'list', properties: ['id', 'data']}),
        got: await run('source', {action: 'get', id: 'mapbox-webmcp-s'}),
        gotKeys: await run('source', {action: 'get', id: 'mapbox-webmcp-s', properties: ['type', 'missing']})
    }).toMatchObject({
        picked: [{id: 'places', data: expect.any(Object) as unknown}, {id: 'areas', data: expect.any(Object) as unknown}, {id: 'mapbox-webmcp-s', data}],
        got: {id: 'mapbox-webmcp-s', type: 'geojson', data},
        gotKeys: {type: 'geojson', missing: null}
    });
});

test('source get refuses a call without an id or with an id that the style lacks, and points to list', async () => {
    const {registered} = await addPlaces();
    expect([
        await registered.get('source')!.execute({action: 'get'}),
        await registered.get('source')!.execute({action: 'get', id: 'nope'})
    ]).toEqual([
        {type: 'error', error: {message: 'Give an id. List the sources to see them.'}},
        {type: 'error', error: {message: 'No source "nope" in the root style. List the sources to see them.'}}
    ]);
});

test('source add returns the source as the style holds it', async () => {
    const {run} = await addControl(tools);
    const data = collection(point(1, 0));
    expect(await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data, generateId: true}})).toEqual({
        id: 'mapbox-webmcp-s', source: {type: 'geojson', data, generateId: true}
    });
});

test.each([
    {input: {action: 'addSource', id: 'places-2', source: {type: 'geojson', data: collection()}}},
    {input: {action: 'removeSource', id: 'places'}},
    {input: {action: 'setData', id: 'places', data: collection()}}
])('source $input.action refuses an id without the prefix, and changes no source', async ({input}) => {
    const {map, registered} = await addPlaces();
    const before = map.getStyle().sources;
    expect({result: await registered.get('source')!.execute(input), sources: map.getStyle().sources}).toEqual({
        result: {type: 'error', error: {message: `The tools add, change and remove only their own sources, with an id that starts with "mapbox-webmcp-", and "${input.id}" does not.`}},
        sources: before
    });
});

test('source add refuses a source that GL JS refuses, and adds nothing', async () => {
    const {map, registered} = await addControl(tools);
    expect({result: await registered.get('source')!.execute({action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: collection(), cluster: 'yes'}}), sources: map.getStyle().sources}).toEqual({
        result: {type: 'error', error: {message: 'sources.mapbox-webmcp-s.cluster: boolean expected, string found'}}, sources: {}
    });
});

test('source remove keeps a source that a layer uses and returns the GL JS error, and removes it when no layer uses it', async () => {
    const {map, run, registered} = await addControl(tools);
    await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: collection()}});
    map.addLayer({id: 'l', type: 'circle', source: 'mapbox-webmcp-s'});
    const refused = await registered.get('source')!.execute({action: 'removeSource', id: 'mapbox-webmcp-s'});
    const kept = Object.keys(map.getStyle().sources);
    map.removeLayer('l');
    expect({refused, kept, removed: await run('source', {action: 'removeSource', id: 'mapbox-webmcp-s'})}).toEqual({
        refused: {type: 'error', error: {message: 'Source "mapbox-webmcp-s" cannot be removed while layer "l" is using it.'}},
        kept: ['mapbox-webmcp-s'],
        removed: []
    });
});

test('source setData changes the features that feature query returns for a layer on that source', async () => {
    const {map, run} = await addControl(tools, undefined, undefined, {zoom: 0});
    await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: collection(point(1, 0))}});
    map.addLayer({id: 'l', type: 'circle', source: 'mapbox-webmcp-s'});
    await loaded(map);
    const data = collection(point(2, 10), point(3, 20));
    const set = await run('source', {action: 'setData', id: 'mapbox-webmcp-s', data});
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown}[]};
    expect({set, ids: features.map((f) => f.id)}).toEqual({set: {id: 'mapbox-webmcp-s', source: {type: 'geojson', data}}, ids: [2, 3]});
});

test('source setData returns the GL JS error for data that GL JS fails to load, and the source holds that data, as GL JS keeps it', async () => {
    const {map, run, registered} = await addControl(tools, undefined, undefined, {zoom: 0});
    const data = collection(point(1, 0));
    await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data}});
    map.addLayer({id: 'l', type: 'circle', source: 'mapbox-webmcp-s'});
    await loaded(map);
    const result = await registered.get('source')!.execute({action: 'setData', id: 'mapbox-webmcp-s', data: {type: 'Foo'}});
    const {features} = await run('feature', {action: 'query', target: {layerId: 'l'}}) as {features: {id: unknown}[]};
    expect({result, source: map.getStyle().sources['mapbox-webmcp-s'], ids: features.map((f) => f.id)}).toEqual({
        result: {type: 'error', error: {message: 'Input data is not a valid GeoJSON object.'}}, source: {type: 'geojson', data: {type: 'Foo'}}, ids: [1]
    });
});

test('layer addLayer adds a layer on an app source that a feature query lists and that feature query and set read', async () => {
    const {map, run} = await addPlaces();
    const added = await run('layer', {action: 'addLayer', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: 'places', filter: ['>=', ['get', 'rating'], 4]}});
    const listed = (await run('feature', {action: 'list'}) as unknown as {target: {layerId: string}; featureProperties: string[]}[]).find((t) => t.target.layerId === 'mapbox-webmcp-l');
    const {features} = await run('feature', {action: 'query', target: {layerId: 'mapbox-webmcp-l'}}) as {features: {id: unknown}[]};
    const filtered = await run('layer', {action: 'set', layerId: 'mapbox-webmcp-l', filter: ['==', ['get', 'name'], 'c']});
    expect({added, listed, ids: features.map((f) => f.id), filtered, drawn: map.queryRenderedFeatures({layers: ['mapbox-webmcp-l']}).map((f) => f.id)}).toEqual({
        added: {layer: {id: 'mapbox-webmcp-l', type: 'circle', source: 'places', filter: ['>=', ['get', 'rating'], 4]}},
        listed: {target: {layerId: 'mapbox-webmcp-l'}, featureProperties: ['name', 'rating']},
        ids: [2, 3],
        filtered: {layerId: 'mapbox-webmcp-l', filter: ['==', ['get', 'name'], 'c'], matched: 1},
        drawn: [3]
    });
});

test('layer addLayer with beforeId puts the layer under that layer, and removeLayer returns the tool\'s layers that are left', async () => {
    const {map, run} = await addPlaces();
    await run('layer', {action: 'addLayer', layer: {id: 'mapbox-webmcp-a', type: 'circle', source: 'places'}});
    await run('layer', {action: 'addLayer', layer: {id: 'mapbox-webmcp-b', type: 'circle', source: 'places'}, beforeId: 'places'});
    const order = map.getStyle().layers.map((l) => l.id);
    expect({order, removed: await run('layer', {action: 'removeLayer', layerId: 'mapbox-webmcp-a'})}).toEqual({
        order: ['mapbox-webmcp-b', 'places', 'areas', 'mapbox-webmcp-a'],
        removed: {layers: [{id: 'mapbox-webmcp-b', type: 'circle'}]}
    });
});

test.each([
    {name: 'addLayer with an id without the prefix', input: {action: 'addLayer', layer: {id: 'places-2', type: 'circle', source: 'places'}}, message: 'The tools add, change and remove only their own layers, with an id that starts with "mapbox-webmcp-", and "places-2" does not.'},
    {name: 'removeLayer with an id without the prefix', input: {action: 'removeLayer', layerId: 'places'}, message: 'The tools add, change and remove only their own layers, with an id that starts with "mapbox-webmcp-", and "places" does not.'},
    {name: 'addLayer with a layer that GL JS refuses', input: {action: 'addLayer', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: 'places', paint: {'circle-radius': 'big'}}}, message: 'layers.mapbox-webmcp-l.paint.circle-radius: number expected, string found'},
    {name: 'addLayer before a layer that the map does not have', input: {action: 'addLayer', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: 'places'}, beforeId: 'roads'}, message: 'Layer with id "roads" does not exist on this map.'}
])('layer $name refuses it, and changes no layer', async ({input, message}) => {
    const {map, registered} = await addPlaces();
    expect({result: await registered.get('layer')!.execute(input), layers: map.getStyle().layers.map((l) => l.id)}).toEqual({
        result: {type: 'error', error: {message}}, layers: ['places', 'areas']
    });
});

test('layer addLayer and removeLayer refuse an importId, and change no layer', async () => {
    const {map, registered} = await addPlaces();
    const message = () => ({type: 'error', error: {message: 'You can add and remove layers only in the root style. Leave out importId.'}});
    expect({
        added: await registered.get('layer')!.execute({action: 'addLayer', importId: 'basemap', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: 'places'}}),
        removed: await registered.get('layer')!.execute({action: 'removeLayer', importId: 'basemap', layerId: 'mapbox-webmcp-l'}),
        layers: map.getStyle().layers.map((l) => l.id)
    }).toEqual({added: message(), removed: message(), layers: ['places', 'areas']});
});

test('feature query with no features returns the config that hides the layer, from the import that the expression reads', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [
        {id: 'l', type: 'circle', source: 's', layout: {visibility: ['case', ['config', 'showPlaces', 'basemap'], 'visible', 'none']}}
    ], imports: [
        {id: 'basemap', url: '', data: {version: 8, sources: {}, layers: [], schema: {showPlaces: {type: 'boolean', default: false}}}}
    ]});
    expect((await run('feature', {action: 'query', target: {layerId: 'l'}})).config).toEqual({basemap: {showPlaces: false}});
});

test('feature query with no features returns no config that a layer of an import reads from an import of that import', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [
        {id: 'basemap', url: '', data: {version: 8, schema: {showPoi: {type: 'boolean', default: false}}, sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [
            {id: 'poi', type: 'circle', source: 's', filter: ['config', 'showPoi'], layout: {visibility: ['case', ['config', 'showPlaces', 'places'], 'visible', 'none']}}
        ], featuresets: {poi: {selectors: [{layer: 'poi'}]}}}}
    ]});
    expect((await run('feature', {action: 'query', target: {featuresetId: 'poi', importId: 'basemap'}})).config).toEqual({basemap: {showPoi: false}});
});

test('style set with an import id of "__proto__" leaves Object.prototype alone', async () => {
    const {run} = await addControl(tools);
    await run('style', {action: 'set', config: JSON.parse('{"__proto__": {"polluted": 1}}') as object});
    expect('polluted' in {}).toBe(false);
});

test('source add refuses data that GL JS fails to load, and adds nothing', async () => {
    const {map, registered} = await addControl(tools);
    expect({result: await registered.get('source')!.execute({action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: {type: 'Foo'}}}), sources: map.getStyle().sources}).toEqual({
        result: {type: 'error', error: {message: 'Input data is not a valid GeoJSON object.'}}, sources: {}
    });
});

test('source add takes data that loads while another source fails to load', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('other', {type: 'geojson', data: {type: 'Foo'} as unknown as GeoJSON.GeoJSON});
    expect(await run('source', {action: 'addSource', id: 'mapbox-webmcp-s', source: {type: 'geojson', data: collection()}})).toMatchObject({id: 'mapbox-webmcp-s'});
});

test('layer addLayer with an inline source and a layer that GL JS refuses adds no layer and no source', async () => {
    const {map, registered} = await addPlaces();
    const result = await registered.get('layer')!.execute({action: 'addLayer', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: {type: 'geojson', data: collection()}}, beforeId: 'roads'});
    expect({result, layers: map.getStyle().layers.map((l) => l.id), sources: Object.keys(map.getStyle().sources)}).toEqual({
        result: {type: 'error', error: {message: 'Layer with id "roads" does not exist on this map.'}}, layers: ['places', 'areas'], sources: ['places', 'areas']
    });
});

test('layer addLayer with an inline source that GL JS fails to load refuses it, and adds no layer and no source', async () => {
    const {map, registered} = await addPlaces();
    const result = await registered.get('layer')!.execute({action: 'addLayer', layer: {id: 'mapbox-webmcp-l', type: 'circle', source: {type: 'geojson', data: {type: 'Foo'}}}});
    expect({result, layers: map.getStyle().layers.map((l) => l.id), sources: Object.keys(map.getStyle().sources)}).toEqual({
        result: {type: 'error', error: {message: 'Input data is not a valid GeoJSON object.'}}, layers: ['places', 'areas'], sources: ['places', 'areas']
    });
});

const MARKER_ID = /^mapbox-webmcp-marker-\d+$/;

test('marker add shows a GL JS marker with its popup, both with the plugin id, and list returns it', async () => {
    const {map, run} = await addPlaces();
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}}]}) as unknown as {id: string}[];
    const markers = map.getContainer().querySelectorAll('.mapboxgl-marker');
    markers[0].dispatchEvent(new KeyboardEvent('keypress', {code: 'Enter'}));
    const popup = map.getContainer().querySelector('.mapboxgl-popup');
    expect({
        id,
        markers: markers.length,
        markerId: markers[0].id,
        pin: markers[0].querySelector('svg') !== null,
        popupId: popup?.id,
        popup: popup?.textContent?.includes('Home'),
        list: await run('marker', {action: 'list'})
    }).toEqual({
        id: expect.stringMatching(MARKER_ID) as unknown,
        markers: 1,
        markerId: id,
        pin: true,
        popupId: `${id}-popup`,
        popup: true,
        list: [expect.objectContaining({id, lngLat: {lng: 10, lat: 20}, popup: {isOpen: true}})]
    });
});

test('marker add draws the default marker in the given color', async () => {
    const {map, run} = await addControl({marker});
    await run('marker', {action: 'add', markers: [{lngLat: {lng: 0, lat: 0}, color: '#ff0000'}]});
    expect(map.getContainer().querySelector('.mapboxgl-marker path')!.getAttribute('fill')).toBe('#ff0000');
});

test('marker add gives GL JS an element with the given html in place of the default marker', async () => {
    const {map, run} = await addControl({marker});
    await run('marker', {action: 'add', markers: [{lngLat: {lng: 0, lat: 0}, html: '<b>8</b>'}]});
    const element = map.getContainer().querySelector('.mapboxgl-marker')!;
    expect({label: element.querySelector('b')?.textContent, pin: element.querySelector('svg')}).toEqual({label: '8', pin: null});
});

test('marker add gives the marker options to GL JS and returns what the Marker getters read back', async () => {
    const {run} = await addControl({marker});
    const options = {offset: [1, 2], rotation: 45, rotationAlignment: 'map', pitchAlignment: 'viewport', occludedOpacity: 0.5, altitude: 10, draggable: true};
    expect(await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, ...options}]})).toEqual([{id: expect.stringMatching(MARKER_ID) as unknown, lngLat: {lng: 10, lat: 20}, ...options}]);
});

const openPopup = async (input: object) => {
    const {map, run} = await addControl({marker});
    await run('marker', {action: 'add', markers: [{lngLat: {lng: 0, lat: 0}, popup: input}]});
    map.getContainer().querySelector('.mapboxgl-marker')!.dispatchEvent(new KeyboardEvent('keypress', {code: 'Enter'}));
    return map;
};

test('marker add gives popup html to GL JS as it is, and <br> starts a second line', async () => {
    const map = await openPopup({html: '<b>8. Vasamuseet</b><br>Djurgården'});
    const content = map.getContainer().querySelector('.mapboxgl-popup-content')!;
    const name = content.querySelector('b')!;
    const top = (node: Node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().top;
    };
    expect({html: content.innerHTML.startsWith('<b>8. Vasamuseet</b><br>Djurgården'), secondLine: top(name.nextSibling!.nextSibling!) > top(name)}).toEqual({html: true, secondLine: true});
});

test('marker add gives the popup options to GL JS', async () => {
    const map = await openPopup({text: 'Home', closeButton: false, className: 'home', maxWidth: '100px', anchor: 'top'});
    const popup = map.getContainer().querySelector<HTMLElement>('.mapboxgl-popup')!;
    expect({classes: [...popup.classList], maxWidth: popup.style.maxWidth, closeButtons: popup.querySelectorAll('button').length}).toEqual({
        classes: expect.arrayContaining(['home', 'mapboxgl-popup-anchor-top']) as unknown, maxWidth: '100px', closeButtons: 0
    });
});

test('a marker popup closes on a map click, as a GL JS popup does by default', async () => {
    const map = await openPopup({text: 'Home'});
    map.fire('preclick');
    expect(map.getContainer().querySelector('.mapboxgl-popup')).toBeNull();
});

test.each([
    {input: {action: 'remove'}},
    {input: {action: 'remove', ids: []}}
])('marker $input removes no marker', async ({input}) => {
    const {map, run, registered} = await addPlaces();
    await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}}]});
    await run('marker', {action: 'add', markers: [{lngLat: {lng: 0, lat: 0}}]});
    expect({result: await registered.get('marker')!.execute(input), markers: map.getContainer().querySelectorAll('.mapboxgl-marker').length}).toEqual({
        result: {type: 'error', error: {message: 'Give the ids of the markers to remove. List the markers to see them.'}}, markers: 2
    });
});

test('marker update moves a marker, changes its rotation, draggable and popup, and list returns the new values', async () => {
    const {map, run} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}}]}) as unknown as {id: string}[];
    const updated = await run('marker', {action: 'update', markers: [{id, lngLat: {lng: 30, lat: 40}, rotation: 90, draggable: true, popup: {text: 'Work'}}]});
    map.getContainer().querySelector('.mapboxgl-marker')!.dispatchEvent(new KeyboardEvent('keypress', {code: 'Enter'}));
    const popup = map.getContainer().querySelector('.mapboxgl-popup');
    expect({updated, list: await run('marker', {action: 'list'}), popup: [popup?.id, popup?.textContent?.includes('Work')]}).toEqual({
        updated: [expect.objectContaining({id, lngLat: {lng: 30, lat: 40}, rotation: 90, draggable: true})],
        list: [expect.objectContaining({id, lngLat: {lng: 30, lat: 40}, rotation: 90, draggable: true, popup: {isOpen: true}})],
        popup: [`${id}-popup`, true]
    });
});

test('marker update with an id that the tool did not add changes the other markers, and returns an error that names the id', async () => {
    const {run, registered} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    const result = await registered.get('marker')!.execute({action: 'update', markers: [{id, lngLat: {lng: 30, lat: 40}}, {id: 'mapbox-webmcp-marker-0', lngLat: {lng: 30, lat: 40}}]});
    expect({result, list: await run('marker', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: 'Marker "mapbox-webmcp-marker-0": No marker with this id.\nThe other changes applied. List the markers to see them.'}},
        list: [expect.objectContaining({id, lngLat: {lng: 30, lat: 40}})]
    });
});

test('marker update applies the other changes to each marker when GL JS refuses one, and returns an error that names each refused change', async () => {
    const {run, registered} = await addControl({marker});
    const [{id: a}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    const [{id: b}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    const result = await registered.get('marker')!.execute({action: 'update', markers: [{id: a, lngLat: {lng: 0, lat: 100}, rotation: 45}, {id: b, lngLat: {lng: 0, lat: 100}, rotation: 45}]});
    const refused = 'Invalid LngLat latitude value: must be between -90 and 90';
    expect({result, list: await run('marker', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: `Marker "${a}" lngLat: ${refused}\nMarker "${b}" lngLat: ${refused}\nThe other changes applied. List the markers to see them.`}},
        list: [expect.objectContaining({id: a, lngLat: {lng: 10, lat: 20}, rotation: 45}), expect.objectContaining({id: b, lngLat: {lng: 10, lat: 20}, rotation: 45})]
    });
});

test('marker update with a lngLat that has no lat is refused, and moves no marker', async () => {
    const {run, registered} = await addControl({marker});
    const [{id: a}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    const [{id: b}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    const result = await registered.get('marker')!.execute({action: 'update', markers: [{id: a, lngLat: {lng: 30}}, {id: b, lngLat: {lng: 30, lat: 40}}]});
    expect({result, list: await run('marker', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: expect.stringContaining('markers[0].lngLat.lat') as string}},
        list: [expect.objectContaining({id: a, lngLat: {lng: 10, lat: 20}}), expect.objectContaining({id: b, lngLat: {lng: 10, lat: 20}})]
    });
});

test('marker list leaves out a marker that the app removed, and update has no marker with its id', async () => {
    const addTo = vi.spyOn(mapboxgl.Marker.prototype, 'addTo');
    onTestFinished(() => addTo.mockRestore());
    const {run, registered} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    (addTo.mock.contexts[0] as mapboxgl.Marker).remove();
    expect({list: await run('marker', {action: 'list'}), update: await registered.get('marker')!.execute({action: 'update', markers: [{id, rotation: 90}]})}).toEqual({
        list: [], update: {type: 'error', error: {message: `Marker "${id}": No marker with this id.`}}
    });
});

test('marker list returns where GL JS shows a marker after the app moves it', async () => {
    const addTo = vi.spyOn(mapboxgl.Marker.prototype, 'addTo');
    onTestFinished(() => addTo.mockRestore());
    const {run} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    (addTo.mock.contexts[0] as mapboxgl.Marker).setLngLat([30, 40]);
    expect(await run('marker', {action: 'list'})).toEqual([expect.objectContaining({id, lngLat: {lng: 30, lat: 40}})]);
});

test('marker add with popupOpen opens the popup with no click, and list returns it open', async () => {
    const {map, run} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}, popupOpen: true}]}) as unknown as {id: string}[];
    expect({popupId: map.getContainer().querySelector('.mapboxgl-popup')?.id, list: await run('marker', {action: 'list'})}).toEqual({
        popupId: `${id}-popup`, list: [expect.objectContaining({id, popup: {isOpen: true}})]
    });
});

test('marker add with popupOpen and no popup adds the marker, and returns an error that names popupOpen', async () => {
    const {run, registered} = await addControl({marker});
    const result = await registered.get('marker')!.execute({action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popupOpen: true}]});
    const list = await run('marker', {action: 'list'}) as unknown as {id: string}[];
    expect({result, list}).toEqual({
        result: {type: 'error', error: {message: 'markers[0] popupOpen: The marker has no popup.\nThe other changes applied. List the markers to see them.'}},
        list: [expect.objectContaining({lngLat: {lng: 10, lat: 20}})]
    });
});

test('marker update with popupOpen false closes the popup of each marker, and returns an error that names a marker with no popup', async () => {
    const {map, run, registered} = await addControl({marker});
    const [{id: a}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}, popupOpen: true}]}) as unknown as {id: string}[];
    const [{id: b}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 0, lat: 0}}]}) as unknown as {id: string}[];
    const result = await registered.get('marker')!.execute({action: 'update', markers: [{id: a, popupOpen: false}, {id: b, popupOpen: false}]});
    expect({result, popups: map.getContainer().querySelectorAll('.mapboxgl-popup').length, list: await run('marker', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: `Marker "${b}" popupOpen: The marker has no popup.\nThe other changes applied. List the markers to see them.`}},
        popups: 0,
        list: [expect.objectContaining({id: a, popup: {isOpen: false}}), expect.not.objectContaining({popup: expect.anything() as unknown})]
    });
});

test('marker update with a new popup and popupOpen opens the new popup', async () => {
    const {map, run} = await addControl({marker});
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}, popup: {text: 'Home'}, popupOpen: true}]}) as unknown as {id: string}[];
    await run('marker', {action: 'update', markers: [{id, popup: {text: 'Work'}, popupOpen: true}]});
    expect(Array.from(map.getContainer().querySelectorAll('.mapboxgl-popup'), (p) => [p.id, p.textContent?.includes('Work')])).toEqual([[`${id}-popup`, true]]);
});

const POPUP_ID = /^mapbox-webmcp-popup-\d+$/;

test('popup add shows a GL JS popup with the plugin id at the LngLat, and list returns it', async () => {
    const {map, run} = await addControl({popup});
    const added = await run('popup', {action: 'add', lngLat: {lng: 10, lat: 20}, text: 'Home', maxWidth: '100px'});
    const element = map.getContainer().querySelector('.mapboxgl-popup');
    expect({added, element: [element?.id, element?.textContent?.includes('Home')], list: await run('popup', {action: 'list'})}).toEqual({
        added: {id: expect.stringMatching(POPUP_ID) as unknown, lngLat: {lng: 10, lat: 20}, maxWidth: '100px'},
        element: [added.id, true],
        list: [added]
    });
});

test('popup list leaves out a popup that a map click closed', async () => {
    const {map, run} = await addControl({popup});
    await run('popup', {action: 'add', lngLat: {lng: 10, lat: 20}, text: 'Home'});
    map.fire('preclick');
    expect(await run('popup', {action: 'list'})).toEqual([]);
});

test('popup update moves a popup and changes its text, and returns an error that names an id with no popup', async () => {
    const {map, run, registered} = await addControl({popup});
    const {id} = await run('popup', {action: 'add', lngLat: {lng: 10, lat: 20}, text: 'Home'});
    const result = await registered.get('popup')!.execute({action: 'update', ids: [id, 'mapbox-webmcp-popup-0'], lngLat: {lng: 30, lat: 40}, text: 'Work'});
    expect({result, text: map.getContainer().querySelector('.mapboxgl-popup')?.textContent?.includes('Work'), list: await run('popup', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: 'Popup "mapbox-webmcp-popup-0": No popup with this id.\nThe other changes applied. List the popups to see them.'}},
        text: true,
        list: [expect.objectContaining({id, lngLat: {lng: 30, lat: 40}})]
    });
});

test('popup remove removes the popups with the given ids, and returns an error that names an id with no popup', async () => {
    const {map, run, registered} = await addControl({popup});
    const {id: a} = await run('popup', {action: 'add', lngLat: {lng: 10, lat: 20}, text: 'Home'});
    const {id: b} = await run('popup', {action: 'add', lngLat: {lng: 0, lat: 0}, text: 'Work'});
    const result = await registered.get('popup')!.execute({action: 'remove', ids: [a, 'mapbox-webmcp-popup-0']});
    expect({result, popups: map.getContainer().querySelectorAll('.mapboxgl-popup').length, list: await run('popup', {action: 'list'})}).toEqual({
        result: {type: 'error', error: {message: 'Popup "mapbox-webmcp-popup-0": No popup with this id.\nThe other changes applied. List the popups to see them.'}},
        popups: 1,
        list: [expect.objectContaining({id: b})]
    });
});

test('two maps on a page share no markers', async () => {
    const first = await addControl({marker});
    const second = await addControl({marker});
    await first.run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]});
    expect(await second.run('marker_2', {action: 'list'})).toEqual([]);
});

test('each control on a page has its own container id, and a control keeps tool names that no other control uses', async () => {
    const first = await addControl({marker});
    const second = await addControl({camera}, undefined, first.registered);
    expect({
        ids: [first.map, second.map].map((m) => m.getContainer().querySelector('[id^="mapbox-webmcp-control"]')?.id),
        names: [...first.registered.keys()]
    }).toEqual({ids: ['mapbox-webmcp-control', 'mapbox-webmcp-control_2'], names: ['marker', 'camera']});
});

test('marker list and remove leave the app\'s own markers alone', async () => {
    const {map, run} = await addPlaces();
    new mapboxgl.Marker().setLngLat([0, 0]).addTo(map);
    const [{id}] = await run('marker', {action: 'add', markers: [{lngLat: {lng: 10, lat: 20}}]}) as unknown as {id: string}[];
    expect({
        list: await run('marker', {action: 'list'}),
        remove: await run('marker', {action: 'remove', ids: [id]}),
        markers: map.getContainer().querySelectorAll('.mapboxgl-marker').length
    }).toEqual({list: [expect.objectContaining({id, lngLat: {lng: 10, lat: 20}})], remove: [], markers: 1});
});

const flatLight = {id: 'flat', type: 'flat', properties: {}};
const lights: mapboxgl.LightsSpecification[] = [{id: 'sun', type: 'directional', properties: {intensity: 0.4}}, {id: 'sky', type: 'ambient', properties: {intensity: 0.6}}];
const atmosphere = {fog: {range: [1, 2]} as mapboxgl.FogSpecification, lights, rain: {density: 0.5}, snow: {density: 0.5}};
const atmosphereOf = (map: mapboxgl.Map) => ({fog: map.getFog(), lights: map.getLights(), light: map.getStyle().light, rain: map.getRain(), snow: map.getSnow(), worldview: map.getWorldview()});

test('style set changes the fog, lights, rain, snow and worldview, and get returns them', async () => {
    const {run} = await addControl(tools);
    await run('style', {action: 'set', ...atmosphere, worldview: 'JP'});
    expect(await run('style', {action: 'get', properties: ['fog', 'lights', 'rain', 'snow', 'worldview']})).toMatchObject({...atmosphere, worldview: 'JP'});
});

test('style set with null removes the fog, 3D lights, rain and snow', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], ...atmosphere});
    const got = await run('style', {action: 'set', fog: null, lights: null, rain: null, snow: null});
    expect({got: [got.fog, got.lights, got.rain, got.snow], map: atmosphereOf(map)}).toEqual({
        got: [null, [flatLight], null, null], map: {fog: null, lights: [flatLight], light: undefined, rain: null, snow: null, worldview: undefined}
    });
});

test('style set with valid fog and a bad projection changes the fog and returns the projection error', async () => {
    const {map, registered} = await addControl(tools);
    const result = await registered.get('style')!.execute({action: 'set', fog: atmosphere.fog, projection: 'foo'});
    expect({result, fog: map.getFog()}).toEqual({
        result: {type: 'error', error: {message: 'projection: Invalid projection name: foo\nThe other fields changed. Read the style with "get" to see it.'}}, fog: expect.objectContaining(atmosphere.fog) as unknown
    });
});

test('style set with a light that GL JS refuses after one it takes returns the GL JS error, and the map keeps the lights that GL JS holds', async () => {
    const {map, registered} = await addControl(tools, {version: 8, sources: {}, layers: [], lights});
    const result = await registered.get('style')!.execute({action: 'set', lights: [{id: 'sky', type: 'ambient', properties: {intensity: 0.1}}, {id: 'sun', type: 'directional', properties: {intensity: 'x'}}]});
    expect({result, lights: map.getLights()}).toEqual({
        result: {type: 'error', error: {message: 'lights: intensity: number expected, string found'}}, lights: [lights[0], {id: 'sky', type: 'ambient', properties: {intensity: 0.1}}]
    });
});

test('style set where GL JS refuses every field returns each GL JS error', async () => {
    const {map, registered} = await addControl(tools);
    const result = await registered.get('style')!.execute({action: 'set', terrain: {exaggeration: 1.5}, lights: [{id: 'sun', type: 'directional', properties: {intensity: 'x'}}]});
    expect({result, terrain: map.getTerrain()}).toEqual({
        result: {type: 'error', error: {message: 'lights: intensity: number expected, string found\nterrain: terrain: terrain is missing required property "source"'}}, terrain: null
    });
});

const lightSchema: mapboxgl.SchemaSpecification = {lightPreset: {type: 'string', default: 'day', values: ['day', 'night']}};

test('style set leaves the config as it is for a configuration property GL JS does not know', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], schema: lightSchema});
    const set = await run('style', {action: 'set', config: {basemap: {theme: 'faded'}}});
    expect({config: set.config, held: map.getConfig('basemap')}).toEqual({config: {basemap: {theme: null}}, held: {lightPreset: 'day'}});
});

test('style set refuses a config entry that is not an object, and changes nothing', async () => {
    const {map, registered} = await addControl(tools, {version: 8, sources: {}, layers: [], schema: lightSchema});
    const result = await registered.get('style')!.execute({action: 'set', config: {basemap: null}, projection: 'globe'});
    expect({result, projection: map.getProjection().name}).toEqual({
        result: {type: 'error', error: {message: 'The config of "basemap" must be an object of configuration property names and values.'}}, projection: 'mercator'
    });
});

test('style set returns a number outside the configuration property range as GL JS holds it', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], schema: {size: {type: 'number', default: 1, minValue: 0, maxValue: 2}}});
    const set = await run('style', {action: 'set', config: {basemap: {size: 3}}});
    expect({config: set.config, held: map.getConfig('basemap')}).toEqual({config: {basemap: {size: 3}}, held: {size: 3}});
});

test('style set changes the basemap config, projection and language', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {}, layers: [], schema: {
        lightPreset: {type: 'string', default: 'day'},
        showPlaceLabels: {type: 'boolean', default: true}
    }});
    await run('style', {action: 'set', config: {basemap: {lightPreset: 'night', showPlaceLabels: false}}, projection: 'globe', language: 'fr'});
    expect(await run('style', {action: 'get', properties: ['config', 'schema', 'targets', 'projection', 'language', 'terrain']})).toEqual({
        config: {basemap: {lightPreset: 'night', showPlaceLabels: false}},
        schema: {basemap: {lightPreset: {type: 'string', default: 'day'}, showPlaceLabels: {type: 'boolean', default: true}}},
        targets: [],
        projection: 'globe',
        language: 'fr',
        terrain: null
    });
});

test('style get without properties returns the root level properties and the keys that the tool adds, and leaves out layers, sources, color-theme and metadata', async () => {
    const {run} = await addControl(tools, {version: 8, fragment: false, sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [], metadata: {a: 1}, 'color-theme': {data: 'x'}, schema: lightSchema, imports: [
        {id: 'basemap', url: '', data: {version: 8, sources: {}, layers: [], schema: {showLabels: {type: 'boolean', default: true}}}}
    ]});
    const got = await run('style', {action: 'get'});
    expect({keys: Object.keys(got).sort(), imports: got.imports, config: got.config, schema: got.schema}).toEqual({
        keys: ['config', 'fragment', 'imports', 'lights', 'projection', 'schema', 'targets', 'version'],
        imports: [{id: 'basemap', url: ''}],
        config: {'': {lightPreset: 'day'}, basemap: {showLabels: true}},
        schema: {'': lightSchema, basemap: {showLabels: {type: 'boolean', default: true}}}
    });
});

test('style get with properties returns those keys, also layers and sources, and null for a key that the style lacks', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: []});
    expect(await run('style', {action: 'get', properties: ['sources', 'fog', 'misspelled']})).toEqual({
        sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, fog: null, misspelled: null
    });
});

test('style get with an import id returns the style that the import loaded, with its config, schema and targets only', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [
        {id: 'basemap', url: '', data: {
            version: 8,
            sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
            layers: [{id: 'poi', type: 'circle', source: 'pois'}],
            featuresets: {poi: {selectors: [{layer: 'poi'}]}},
            schema: {showLabels: {type: 'boolean', default: true}}
        }},
        {id: 'other', url: '', data: {version: 8, sources: {}, layers: [], featuresets: {stop: {selectors: []}}}}
    ]});
    expect({
        imported: await run('style', {action: 'get', importId: 'basemap', properties: ['featuresets', 'sources', 'config', 'schema', 'targets', 'language']}),
        root: await run('style', {action: 'get', importId: ''}).then(({version}) => version)
    }).toEqual({
        imported: {
            featuresets: {poi: {selectors: [{layer: 'poi'}]}},
            sources: {pois: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
            config: {basemap: {showLabels: true}},
            schema: {basemap: {showLabels: {type: 'boolean', default: true}}},
            targets: [{target: {featuresetId: 'poi', importId: 'basemap'}, layers: ['poi']}],
            language: null
        },
        root: 8
    });
    await expect(run('style', {action: 'get', importId: 'nope'})).rejects.toThrow('No import "nope" with loaded data.');
});

test('style get and set reach the config of the root style', async () => {
    const {map, run} = await addControl(tools, {version: 8, fragment: false, sources: {}, layers: [], schema: lightSchema});
    const set = await run('style', {action: 'set', config: {'': {lightPreset: 'night'}}});
    expect({config: set.config, root: map.getConfig('')}).toEqual({
        config: {'': {lightPreset: 'night'}}, root: {lightPreset: 'night'}
    });
});

test('style set changes the config of two imports', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [
        {id: 'a', url: '', data: {version: 8, sources: {}, layers: [], schema: lightSchema}},
        {id: 'none', url: '', data: {version: 8, sources: {}, layers: []}},
        {id: 'b', url: '', data: {version: 8, sources: {}, layers: [], schema: {showLabels: {type: 'boolean', default: true}}}}
    ]});
    const set = await run('style', {action: 'set', config: {a: {lightPreset: 'night'}, b: {showLabels: false}}});
    expect({config: set.config, a: map.getConfig('a'), b: map.getConfig('b')}).toEqual({
        config: {a: {lightPreset: 'night'}, b: {showLabels: false}}, a: {lightPreset: 'night'}, b: {showLabels: false}
    });
});

test('style set takes back what get returns', async () => {
    const {run} = await addControl(tools, {version: 8, sources: {}, layers: [], projection: {name: 'equalEarth'}, imports: [
        {id: 'basemap', url: '', config: {theme: 'custom'}, data: {version: 8, sources: {}, layers: [], schema: {theme: {type: 'string', default: 'default'}}}}
    ]});
    const got = await run('style', {action: 'get', properties: ['config', 'projection', 'terrain']});
    const {schema, targets, imports} = await run('style', {action: 'get', properties: ['schema', 'targets', 'imports']});
    expect({got, schema, targets, imports, set: await run('style', {...got, action: 'set'})}).toEqual({
        got: {config: {basemap: {theme: 'custom'}}, projection: 'equalEarth', terrain: null},
        schema: {basemap: {theme: {type: 'string', default: 'default'}}},
        targets: [],
        imports: [{id: 'basemap', url: ''}],
        set: {config: {basemap: {theme: 'custom'}}, projection: 'equalEarth', terrain: null}
    });
});

test.each([
    {input: {terrain: {exaggeration: 'x'}}, message: 'terrain.exaggeration: expected number or array, received string'},
    {input: {language: 42}, message: 'language: expected string, received number'}
])('style set with $input refuses it and keeps the projection', async ({input, message}) => {
    const {map, registered} = await addControl(tools);
    const result = await registered.get('style')!.execute({action: 'set', projection: 'globe', ...input});
    expect({result, projection: map.getProjection().name}).toEqual({result: {type: 'error', error: {message}}, projection: 'mercator'});
});

test('style set with a terrain exaggeration that GL JS refuses changes the projection', async () => {
    const {map, registered} = await addControl(tools);
    const result = await registered.get('style')!.execute({action: 'set', projection: 'globe', terrain: {exaggeration: -1}});
    expect({result, projection: map.getProjection().name}).toEqual({
        result: {type: 'error', error: {message: 'terrain: exaggeration: -1 is less than the minimum value 0\nThe other fields changed. Read the style with "get" to see it.'}}, projection: 'globe'
    });
});

test('style set changes the exaggeration of the app\'s own terrain', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('app-dem', {type: 'raster-dem', tiles: ['http://localhost/{z}/{x}/{y}.png'], tileSize: 256});
    map.setTerrain({source: 'app-dem', exaggeration: 1});
    await run('style', {action: 'set', terrain: {exaggeration: 2}});
    expect(map.getTerrain()).toEqual({source: 'app-dem', exaggeration: 2});
});

test('style set terrain keeps the app\'s exaggeration expression', async () => {
    const {map, run} = await addControl(tools);
    const exaggeration: mapboxgl.ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 3];
    map.addSource('app-dem', {type: 'raster-dem', tiles: ['http://localhost/{z}/{x}/{y}.png'], tileSize: 256});
    map.setTerrain({source: 'app-dem', exaggeration});
    await run('style', {action: 'set', terrain: {}});
    expect(map.getTerrain()).toEqual({source: 'app-dem', exaggeration});
});

const dem: mapboxgl.RasterDEMSourceSpecification = {type: 'raster-dem', tiles: [Object.assign(document.createElement('canvas'), {width: 256, height: 256}).toDataURL()], tileSize: 256};

test('style set turns terrain on and off', async () => {
    const {map, run} = await addControl(tools);
    map.addSource('app-dem', dem);
    const on = await run('style', {action: 'set', terrain: {source: 'app-dem', exaggeration: 2}});
    const off = await run('style', {action: 'set', terrain: null});
    expect([on.terrain, off.terrain]).toEqual([{source: 'app-dem', exaggeration: 2}, null]);
});

test('style set with a terrain source that the style does not have returns the GL JS error, and changes the other fields', async () => {
    const {map, registered} = await addControl(tools);
    map.addSource('app-dem', dem);
    map.setTerrain({source: 'app-dem', exaggeration: 1.5});
    const result = await registered.get('style')!.execute({action: 'set', terrain: {source: 'other', exaggeration: 2}, projection: 'globe'});
    expect({result, terrain: map.getTerrain(), projection: map.getProjection().name}).toEqual({
        result: {type: 'error', error: {message: 'terrain: terrain.source: source "other" not found\nThe other fields changed. Read the style with "get" to see it.'}}, terrain: {source: 'app-dem', exaggeration: 1.5}, projection: 'globe'
    });
});

test('style set terrain without a source returns the GL JS error when terrain is off, and keeps terrain off', async () => {
    const {map, registered} = await addControl(tools);
    map.addSource('app-dem', dem);
    const result = await registered.get('style')!.execute({action: 'set', terrain: {exaggeration: 2}});
    expect({result, terrain: map.getTerrain()}).toEqual({result: {type: 'error', error: {message: 'terrain: terrain: terrain is missing required property "source"'}}, terrain: null});
});

test('style set terrain exaggeration keeps the raster-dem source of terrain that comes from an import', async () => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [
        {id: 'basemap', url: '', data: {version: 8, sources: {dem}, layers: [], terrain: {source: 'dem', exaggeration: 1.5}}}
    ]});
    await run('style', {action: 'set', terrain: {exaggeration: 2}});
    expect({terrain: map.getTerrain(), sources: Object.keys(map.getStyle().sources)}).toEqual({terrain: {source: 'dem', exaggeration: 2}, sources: []});
});

test.each([
    {name: 'as the import sets it', exaggeration: undefined, terrain: {source: 'dem', exaggeration: 1.5}},
    {name: 'after a new exaggeration', exaggeration: 2, terrain: {source: 'dem', exaggeration: 2}}
])('style set with terrain null returns the terrain that comes from an import $name, as GL JS keeps it', async ({exaggeration, terrain}) => {
    const {map, run} = await addControl(tools, {version: 8, sources: {}, layers: [], imports: [
        {id: 'basemap', url: '', data: {version: 8, sources: {dem}, layers: [], terrain: {source: 'dem', exaggeration: 1.5}}}
    ]});
    if (exaggeration) await run('style', {action: 'set', terrain: {exaggeration}});
    const result = await run('style', {action: 'set', terrain: null, projection: 'globe'});
    expect({result, terrain: map.getTerrain(), projection: map.getProjection().name}).toMatchObject({
        result: {terrain, projection: 'globe'},
        terrain,
        projection: 'globe'
    });
});

const ownImport = {id: 'mapbox-webmcp-i', url: '', data: {version: 8 as const, sources: {}, layers: [], schema: lightSchema}};
const withBasemap: mapboxgl.StyleSpecification = {version: 8, sources: {}, layers: [], imports: [{id: 'basemap', url: '', data: {version: 8, sources: {}, layers: []}}]};

test('style addImport adds an import that get lists with its configuration properties, and removeImport removes it', async () => {
    const {run} = await addControl(tools, withBasemap);
    const added = await run('style', {action: 'addImport', import: ownImport, beforeId: 'basemap'});
    const {config} = await run('style', {action: 'get'});
    expect({added, config, removed: await run('style', {action: 'removeImport', importId: 'mapbox-webmcp-i'})}).toEqual({
        added: {imports: [{id: 'mapbox-webmcp-i', url: ''}, {id: 'basemap', url: ''}]},
        config: {'mapbox-webmcp-i': {lightPreset: 'day'}},
        removed: {imports: [{id: 'basemap', url: ''}]}
    });
});

test.each([
    {name: 'removeImport of an import that the app added', input: {action: 'removeImport', importId: 'basemap'}, message: 'The tools add, change and remove only their own imports, with an id that starts with "mapbox-webmcp-", and "basemap" does not.'},
    {name: 'addImport with an id without the prefix', input: {action: 'addImport', import: {...ownImport, id: 'other'}}, message: 'The tools add, change and remove only their own imports, with an id that starts with "mapbox-webmcp-", and "other" does not.'},
])('style $name refuses it, and keeps the imports as they were', async ({input, message}) => {
    const {map, registered} = await addControl(tools, withBasemap);
    expect({result: await registered.get('style')!.execute(input), imports: map.getStyle().imports!.map((i) => i.id)}).toEqual({
        result: {type: 'error', error: {message}}, imports: ['basemap']
    });
});

test('style addImport before an import that the style does not have returns the GL JS error, and says that GL JS added the import', async () => {
    const {map, registered} = await addControl(tools, withBasemap);
    expect({result: await registered.get('style')!.execute({action: 'addImport', import: ownImport, beforeId: 'nope'}), imports: map.getStyle().imports!.map((i) => i.id).sort()}).toEqual({
        result: {type: 'error', error: {message: 'Import with id "nope" does not exist on this map. GL JS added the import "mapbox-webmcp-i" anyway, before the import "basemap".'}}, imports: ['basemap', 'mapbox-webmcp-i']
    });
});

test('style addImport before an import that the style does not have, with a style that GL JS refuses, removes the import and returns both GL JS errors', async () => {
    const {map, registered} = await addControl(tools, withBasemap);
    const result = await registered.get('style')!.execute({action: 'addImport', import: {...ownImport, data: {version: 8, sources: {}, layers: [{id: 'x', type: 'nope'}]}}, beforeId: 'nope'});
    expect({result, imports: map.getStyle().imports!.map((i) => i.id)}).toEqual({
        result: {type: 'error', error: {message: 'Import with id "nope" does not exist on this map.\nThe import "mapbox-webmcp-i" did not load, so the tool removed it. GL JS reported this error during the wait: layers[0]: missing required property "source"'}},
        imports: ['basemap']
    });
});

test('style addImport with a style that GL JS refuses removes the import and returns the GL JS error', async () => {
    const {map, registered} = await addControl(tools, withBasemap);
    const result = await registered.get('style')!.execute({action: 'addImport', import: {...ownImport, data: {version: 8, sources: {}, layers: [{id: 'x', type: 'nope'}]}}});
    expect({result, imports: map.getStyle().imports!.map((i) => i.id)}).toEqual({
        result: {type: 'error', error: {message: 'The import "mapbox-webmcp-i" did not load, so the tool removed it. GL JS reported this error during the wait: layers[0]: missing required property "source"'}},
        imports: ['basemap']
    });
});

test('style addImport adds an import while another source fails to load', async () => {
    const {map, run} = await addControl(tools, withBasemap);
    map.addSource('other', {type: 'geojson', data: {type: 'Foo'} as unknown as GeoJSON.GeoJSON});
    expect(await run('style', {action: 'addImport', import: ownImport})).toEqual({imports: [{id: 'basemap', url: ''}, {id: 'mapbox-webmcp-i', url: ''}]});
});

test('style addImport with the id of an import that the tool added refuses it, and keeps that import', async () => {
    const {map, run, registered} = await addControl(tools, withBasemap);
    await run('style', {action: 'addImport', import: ownImport});
    expect({result: await registered.get('style')!.execute({action: 'addImport', import: ownImport}), imports: map.getStyle().imports!.map((i) => i.id)}).toEqual({
        result: {type: 'error', error: {message: 'Import with id \'mapbox-webmcp-i\' already exists in the map\'s style.'}}, imports: ['basemap', 'mapbox-webmcp-i']
    });
});

describe('telemetry', () => {
    function hidePage() {
        Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
        Reflect.deleteProperty(document, 'visibilityState');
    }

    async function addCountedControl() {
        const control = await addControl({camera, pins: marker});
        const events: unknown[] = [];
        control.map.on('telemetry', ({type, target, ...data}) => events.push(data));
        await control.run('camera', {action: 'get'});
        await control.run('camera', {action: 'get'});
        await control.run('pins', {action: 'list'});
        return {events, ...control};
    }

    const counts = {eventType: 'metrics', counters: [{name: 'maps/js/webmcp/camera', value: 2}, {name: 'maps/js/webmcp/marker', value: 1}]};

    test.each([
        {end: 'hiding the page', endSession: hidePage},
        {end: 'the pagehide event', endSession: () => window.dispatchEvent(new Event('pagehide'))},
        {end: 'removing the control', endSession: ({map, control}: {map: mapboxgl.Map; control: mapboxgl.IControl}) => map.removeControl(control)},
        {end: 'removing the map', endSession: ({map}: {map: mapboxgl.Map}) => map.remove()}
    ])('$end fires one telemetry event with the count of each built-in tool', async ({endSession}) => {
        const control = await addCountedControl();
        endSession(control);
        expect(control.events).toEqual([counts]);
    });

    test('a second session end with no new calls fires nothing', async () => {
        const {events} = await addCountedControl();
        hidePage();
        hidePage();
        expect(events).toEqual([counts]);
    });

    test('a page that turns visible fires nothing', async () => {
        const {events} = await addCountedControl();
        document.dispatchEvent(new Event('visibilitychange'));
        expect(events).toEqual([]);
    });

    test('each control fires the counts of its own calls on its own map', async () => {
        const first = await addControl({camera});
        const second = await addControl({camera}, undefined, first.registered);
        const events: [string, unknown][] = [];
        first.map.on('telemetry', ({type, target, ...data}) => events.push(['first', data]));
        second.map.on('telemetry', ({type, target, ...data}) => events.push(['second', data]));
        await second.run('camera_2', {action: 'get'});
        hidePage();
        expect(events).toEqual([['second', {eventType: 'metrics', counters: [{name: 'maps/js/webmcp/camera', value: 1}]}]]);
    });

    test('a built-in tool call with bad input does not count', async () => {
        const {map, registered} = await addControl({camera});
        const telemetry = vi.fn();
        map.on('telemetry', telemetry);
        await registered.get('camera')!.execute({action: 'spin'});
        hidePage();
        expect(telemetry).not.toHaveBeenCalled();
    });

    test('a custom tool call fires no telemetry event', async () => {
        const {map, run} = await addControl(tool(() => null));
        const telemetry = vi.fn();
        map.on('telemetry', telemetry);
        await run('test', {});
        hidePage();
        expect(telemetry).not.toHaveBeenCalled();
    });
});

