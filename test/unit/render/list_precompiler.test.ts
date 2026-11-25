import {describe, test, expect, vi, waitFor, createMap} from '../../util/vitest';
import {ListPrecompiler, firstBatch, precompileListFor} from '../../../src/render/list_precompiler';
import Transform from '../../../src/geo/transform';

import type {PrecompileList} from '../../../src/render/precompile_lists';

describe('firstBatch', () => {
    test('takes entries in list order until one doesn\'t fit', () => {
        expect(firstBatch([10, 20, 500, 30], 100)).toEqual([0, 1]);
    });

    test('skips entries that can\'t be built yet', () => {
        expect(firstBatch([10, null, 20], 40)).toEqual([0, 2]);
    });

    test('takes nothing when the first entry doesn\'t fit', () => {
        expect(firstBatch([100, 10], 50)).toEqual([]);
    });
});

describe('precompileListFor', () => {
    // A camera at this zoom and pitch, or null for a map that sets no camera.
    function transformAt(zoom: number | null, pitch = 0) {
        const transform = new Transform();
        transform.resize(512, 512);
        if (zoom !== null) {
            transform.zoom = zoom;
            transform.pitch = pitch;
            // As Map does when its options set a camera, even one that matches the default.
            transform._unmodified = false;
        }
        return transform;
    }

    // Lists recorded for one style, split at zoom 6; the style opens at zoom 11.
    function recorded() {
        const low: PrecompileList = {idleWindow: 100, entries: []};
        const high: PrecompileList = {idleWindow: 200, entries: []};
        const zoomGroups = [{name: 'low', min: 0, max: 6}, {name: 'high', min: 6, max: 100}];
        return {lists: {'mapbox://styles/test/style': {defaultZoom: 11, zoomGroups, lists: {low, high}}}, low, high};
    }

    test('gives nothing for a style without lists', () => {
        expect(precompileListFor(recorded().lists, 'json://123', transformAt(12))).toBeNull();
    });

    test('ignores the query of the style URL', () => {
        const {lists, high} = recorded();
        expect(precompileListFor(lists, 'mapbox://styles/test/style?fresh=true', transformAt(12))).toBe(high);
    });

    test('picks the list of the zoom group the camera is in', () => {
        const {lists, low} = recorded();
        expect(precompileListFor(lists, 'mapbox://styles/test/style', transformAt(3))).toBe(low);
    });

    test('picks the list at the style\'s own zoom for a map that sets no camera', () => {
        const {lists, low, high} = recorded();
        const url = 'mapbox://styles/test/style';
        expect({noCamera: precompileListFor(lists, url, transformAt(null)), zoom0: precompileListFor(lists, url, transformAt(0))})
            .toEqual({noCamera: high, zoom0: low});
    });

    test('gives nothing past the pitch where fog starts', () => {
        const {lists, high} = recorded();
        const url = 'mapbox://styles/test/style';
        expect({atStart: precompileListFor(lists, url, transformAt(12, 45)), past: precompileListFor(lists, url, transformAt(12, 46))})
            .toEqual({atStart: high, past: null});
    });
});

describe('ListPrecompiler', () => {
    // A map that draws nothing, so the painter builds none of the programs these lists hold.
    async function loadedMap() {
        const map = createMap();
        await waitFor(map, 'load');
        return map;
    }

    function list(idleWindow: number, keys: string[] = ['background']): PrecompileList {
        return {idleWindow, entries: keys.map(key => ({key, steps: [5, 5, 5]}))};
    }

    // The programs created on this context from now on.
    function createdPrograms(gl: WebGL2RenderingContext): WebGLProgram[] {
        const created: WebGLProgram[] = [];
        const createProgram = gl.createProgram.bind(gl);
        vi.spyOn(gl, 'createProgram').mockImplementation(() => {
            const program = createProgram();
            created.push(program);
            return program;
        });
        return created;
    }

    test('links the first batch right away', async () => {
        const map = await loadedMap();
        const precompiler = new ListPrecompiler(map.painter, list(100, ['background', 'fill']), () => false);
        expect([precompiler.take('background'), precompiler.take('fill')].every(linked => linked && linked.program instanceof WebGLProgram)).toBe(true);
        precompiler.stop('contextAlive');
        map.remove();
    });

    test('hands a linked program over once', async () => {
        const map = await loadedMap();
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        precompiler.take('background');
        expect(precompiler.take('background')).toBeNull();
        precompiler.stop('contextAlive');
        map.remove();
    });

    test('builds what doesn\'t fit the first batch after the next frames', async () => {
        const map = await loadedMap();
        const precompiler = new ListPrecompiler(map.painter, list(10), () => false);
        const beforeFrames = precompiler.take('background');
        precompiler.afterFrame();
        const linked = await vi.waitUntil(() => precompiler.take('background'), {timeout: 3000, interval: 5});
        expect({beforeFrames, linked: linked.program instanceof WebGLProgram}).toEqual({beforeFrames: null, linked: true});
        precompiler.stop('contextAlive');
        map.remove();
    });

    test('builds one step per submission while a frame waits', async () => {
        const map = await loadedMap();
        const precompiler = new ListPrecompiler(map.painter, list(10), () => true);
        const fenceSync = vi.spyOn(map.painter.context.gl, 'fenceSync');
        precompiler.afterFrame();
        await vi.waitUntil(() => precompiler.take('background'), {timeout: 3000, interval: 5});
        // Each submission ends with a fence: the fragment shader, the vertex shader, then the link.
        expect(fenceSync.mock.calls.length).toBe(3);
        precompiler.stop('contextAlive');
        map.remove();
    });

    test('skips programs the painter has built', async () => {
        const map = createMap({style: {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': 'red'}}]}});
        await waitFor(map, 'idle');
        const key = [...map.painter.cache.keys()].find(k => k.split('/')[0] === 'background');
        const precompiler = new ListPrecompiler(map.painter, list(100, [key]), () => false);
        expect(precompiler.take(key)).toBeNull();
        precompiler.stop('contextAlive');
        map.remove();
    });

    test('deletes the programs not taken when it stops', async () => {
        const map = await loadedMap();
        const gl = map.painter.context.gl;
        const created = createdPrograms(gl);
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        precompiler.stop('contextAlive');
        expect({taken: precompiler.take('background'), live: created.map(program => gl.isProgram(program))}).toEqual({taken: null, live: [false]});
        map.remove();
    });

    test('leaves the programs to a lost context when it stops', async () => {
        const map = await loadedMap();
        const gl = map.painter.context.gl;
        const created = createdPrograms(gl);
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        precompiler.stop('contextLost');
        expect({taken: precompiler.take('background'), live: created.map(program => gl.isProgram(program))}).toEqual({taken: null, live: [true]});
        map.remove();
    });

    test('does nothing on a lost context', async () => {
        const map = await loadedMap();
        const lost = waitFor(map, 'webglcontextlost');
        map.painter.context.gl.getExtension('WEBGL_lose_context').loseContext();
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        const taken = precompiler.take('background');
        await lost;
        expect(taken).toBeNull();
        map.remove();
    });

    // afterFrame runs before the webglcontextlost event, which comes a task after the loss.
    test('stops at the next frame once the context is lost', async () => {
        const map = await loadedMap();
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        const lost = waitFor(map, 'webglcontextlost');
        map.painter.context.gl.getExtension('WEBGL_lose_context').loseContext();
        precompiler.afterFrame();
        const taken = precompiler.take('background');
        await lost;
        expect(taken).toBeNull();
        map.remove();
    });

    test('stops when precompiling fails', async () => {
        const map = await loadedMap();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(map.painter.context.gl, 'fenceSync').mockImplementation(() => { throw new Error('no fence at the start'); });
        const precompiler = new ListPrecompiler(map.painter, list(100), () => false);
        expect(precompiler.take('background')).toBeNull();
        map.remove();
    });

    test('stops when precompiling fails between frames', async () => {
        const map = await loadedMap();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const precompiler = new ListPrecompiler(map.painter, list(10), () => false);
        const fenceSync = vi.spyOn(map.painter.context.gl, 'fenceSync').mockImplementation(() => { throw new Error('no fence between frames'); });
        precompiler.afterFrame();
        await vi.waitUntil(() => fenceSync.mock.calls.length, {timeout: 3000, interval: 5});
        expect(precompiler.take('background')).toBeNull();
        map.remove();
    });
});
