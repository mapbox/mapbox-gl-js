import {describe, test, expect, vi} from "../../util/vitest.js";
import CanvasSource from '../../../src/source/canvas_source.js';
import Transform from '../../../src/geo/transform.js';
import {Event, Evented} from '../../../src/util/evented.js';
import {extend} from '../../../src/util/util.js';

function createSource(options) {
    const c = (options && options.canvas) || window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }, options);

    const source = new CanvasSource('id', options, {send() {}}, options.eventedParent);

    source.canvas = c;

    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this.style = {};
    }

    triggerRepaint() {
        this.fire(new Event('rerender'));
    }
}

describe('CanvasSource', () => {
    test('constructor', async () => {
        const source = createSource();

        expect(source.minzoom).toEqual(0);
        expect(source.maxzoom).toEqual(22);
        expect(source.tileSize).toEqual(512);
        expect(source.animate).toEqual(true);
        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    expect(typeof source.play).toEqual('function');
                    resolve();
                }
            });

            source.onAdd(new StubMap());
        });
    });

    test('self-validates', () => {
        const stub = vi.spyOn(console, 'error').mockImplementation(() => {});
        createSource({coordinates: []});
        expect(stub).toHaveBeenCalled();
        stub.mockClear();

        createSource({coordinates: 'asdf'});
        expect(stub).toHaveBeenCalled();
        stub.mockClear();

        createSource({animate: 8});
        expect(stub).toHaveBeenCalled();
        stub.mockClear();

        createSource({canvas: {}});
        expect(stub).toHaveBeenCalled();
        stub.mockClear();

        const canvasEl = window.document.createElement('canvas');
        createSource({canvas: canvasEl});
        expect(stub).not.toHaveBeenCalled();
        stub.mockClear();
    });

    test('can be initialized with HTML element', async () => {
        const el = window.document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    expect(source.canvas).toBe(el);
                    resolve();
                }
            });

            source.onAdd(new StubMap());
        });
    });

    test('rerenders if animated', async () => {
        const source = createSource();
        const map = new StubMap();

        await new Promise((resolve) => {
            map.on('rerender', () => {
                resolve();
            });

            source.onAdd(map);
        });
    });

    test('can be static', async () => {
        const source = createSource({
            animate: false
        });
        const map = new StubMap();

        map.on('rerender', () => {
            expect.unreachable();
        });

        await new Promise(resolve => {
            source.on('data', e => {
                if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                    resolve();
                }
            });

            source.onAdd(map);
        });
    });

    test('onRemove stops animation', () => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        expect(source.hasTransition()).toEqual(true);

        source.onRemove();

        expect(source.hasTransition()).toEqual(false);

        source.onAdd(map);

        expect(source.hasTransition()).toEqual(true);
    });

    test('play and pause animation', () => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        expect(source.hasTransition()).toEqual(true);

        source.pause();

        expect(source.hasTransition()).toEqual(false);

        source.play();

        expect(source.hasTransition()).toEqual(true);
    });
});

test('CanvasSource#serialize', () => {
    const source = createSource();

    const serialized = source.serialize();
    expect(serialized.type).toEqual('canvas');
    expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
});
