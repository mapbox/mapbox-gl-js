import {describe, test, expect, beforeEach, afterEach, waitFor, createMap} from '../../../util/vitest';
import {mockFetch} from '../../../util/network';
import {ListPrecompiler} from '../../../../src/render/list_precompiler';
import {PRECOMPILE_LISTS} from '../../../../src/render/precompile_lists';

import type {SetStyleOptions} from '../../../../src/ui/map';
import type {StyleSpecification} from '../../../../src/style-spec/types';

// A mocked list is added temporarily for each test since the lists module itself can't be mocked.
const LISTED_STYLE = 'mapbox://styles/test/listed';
beforeEach(() => {
    PRECOMPILE_LISTS[LISTED_STYLE] = {
        defaultZoom: 0,
        zoomGroups: [{name: 'all', min: 0, max: 100}],
        lists: {all: {idleWindow: 100, entries: [{key: 'background', steps: [5, 5, 5]}]}},
    };
});
afterEach(() => {
    delete PRECOMPILE_LISTS[LISTED_STYLE];
});

const STYLE: StyleSpecification = {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': 'red'}}]};

// A map of LISTED_STYLE; its style request, to the Styles API path of that URL, gets a small style.
function createListedMap(options = {}) {
    mockFetch({[LISTED_STYLE.replace('mapbox://styles/', '/styles/v1/')]: () => Promise.resolve(new Response(JSON.stringify(STYLE)))});
    return createMap({precompilePrograms: true, accessToken: 'access-token', center: [0, 0], zoom: 12, style: LISTED_STYLE, ...options});
}

// A map of LISTED_STYLE that repaints all the time: it never goes idle, so its precompile still runs after load.
function createRepaintingMap() {
    return createListedMap({repaint: true});
}

// Whether the map is precompiling its list.
const running = (map: ReturnType<typeof createMap>) => map.painter._listPrecompiler instanceof ListPrecompiler;

// Whether the map was precompiling right after its first frame: load and idle can come in that same frame.
function runningAfterFirstFrame(map: ReturnType<typeof createMap>): () => boolean {
    let result = false;
    map.once('render', () => { result = running(map); });
    return () => result;
}

// Tests remove a map only after its style has loaded: removing the map doesn't cancel the mocked request.
describe('Map precompiling the programs of its style\'s list', () => {
    test('starts on the first frame', async () => {
        const map = createListedMap();
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'load');
        expect(afterFirstFrame()).toBe(true);
        map.remove();
    });

    test('doesn\'t start for a style without lists', async () => {
        const map = createMap({precompilePrograms: true, style: STYLE});
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'load');
        expect(afterFirstFrame()).toBe(false);
        map.remove();
    });

    test('doesn\'t start with precompilePrograms off', async () => {
        const map = createListedMap({precompilePrograms: false});
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'load');
        expect(afterFirstFrame()).toBe(false);
        map.remove();
    });

    test('doesn\'t start with a projection set', async () => {
        const map = createListedMap({projection: 'mercator'});
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'load');
        expect(afterFirstFrame()).toBe(false);
        map.remove();
    });

    test('doesn\'t start while recording the programs of a load', async () => {
        const map = createListedMap({recordProgramsDuringLoad: true});
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'load');
        expect(afterFirstFrame()).toBe(false);
        map.remove();
    });

    test('ends when the map is first idle', async () => {
        const map = createListedMap();
        const afterFirstFrame = runningAfterFirstFrame(map);
        await waitFor(map, 'idle');
        expect({afterFirstFrame: afterFirstFrame(), afterIdle: running(map)}).toEqual({afterFirstFrame: true, afterIdle: false});
        map.remove();
    });

    test('ends on setStyle, and doesn\'t start again', async () => {
        const map = createRepaintingMap();
        await waitFor(map, 'load');
        const before = running(map);
        // Loads the listed style again; without diff: false, setStyle would only diff it against itself.
        map.setStyle(LISTED_STYLE, {diff: false} as SetStyleOptions);
        const afterSetStyle = running(map);
        await waitFor(map, 'style.load');
        await waitFor(map, 'render');
        expect({before, afterSetStyle, later: running(map)}).toEqual({before: true, afterSetStyle: false, later: false});
        map.remove();
    });

    test('ends on setProjection', async () => {
        const map = createRepaintingMap();
        await waitFor(map, 'load');
        const before = running(map);
        map.setProjection('mercator');
        expect({before, after: running(map)}).toEqual({before: true, after: false});
        map.remove();
    });

    test('ends when the context is lost', async () => {
        const map = createRepaintingMap();
        await waitFor(map, 'load');
        const before = running(map);
        map.painter.context.gl.getExtension('WEBGL_lose_context').loseContext();
        await waitFor(map, 'webglcontextlost');
        expect({before, after: running(map)}).toEqual({before: true, after: false});
        map.remove();
    });

    test('ends when the map is removed', async () => {
        const map = createRepaintingMap();
        await waitFor(map, 'load');
        const before = running(map);
        const painter = map.painter;
        map.remove();
        expect({before, after: painter._listPrecompiler}).toEqual({before: true, after: null});
    });
});
