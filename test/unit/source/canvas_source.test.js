import { test } from 'mapbox-gl-js-test';
import CanvasSource from '../../../src/source/canvas_source';
import Transform from '../../../src/geo/transform';
import { Event, Evented } from '../../../src/util/evented';
import { extend } from '../../../src/util/util';
import window from '../../../src/util/window';

function createSource(options) {
    window.useFakeHTMLCanvasGetContext();

    const c = options && options.canvas || window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }, options);

    const source = new CanvasSource('id', options, { send: function() {} }, options.eventedParent);

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

test('CanvasSource', (t) => {
    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('constructor', (t) => {
        const source = createSource();

        t.equal(source.minzoom, 0);
        t.equal(source.maxzoom, 22);
        t.equal(source.tileSize, 512);
        t.equal(source.animate, true);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.equal(typeof source.play, 'function');
                t.end();
            }
        });

        source.onAdd(new StubMap());
    });

    t.test('self-validates', (t) => {
        const stub = t.stub(console, 'error');
        createSource({ coordinates: [] });
        t.ok(stub.called, 'should error when `coordinates` array parameter has incorrect number of elements');
        stub.resetHistory();

        createSource({ coordinates: 'asdf' });
        t.ok(stub.called, 'should error with non-array `coordinates` parameter');
        stub.resetHistory();

        createSource({ animate: 8 });
        t.ok(stub.called, 'should error with non-boolean `animate` parameter');
        stub.resetHistory();

        createSource({ canvas: {} });
        t.ok(stub.called, 'should error with non-string/non-Canvas `canvas` parameter');
        stub.resetHistory();

        const canvasEl = window.document.createElement('canvas');
        createSource({ canvas: canvasEl });
        t.notOk(stub.called, 'should not error with HTMLCanvasElement');
        stub.resetHistory();

        t.end();
    });

    t.test('can be initialized with HTML element', (t) => {
        const el = window.document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.equal(source.canvas, el);
                t.end();
            }
        });

        source.onAdd(new StubMap());
    });

    t.test('rerenders if animated', (t) => {
        const source = createSource();
        const map = new StubMap();

        map.on('rerender', () => {
            t.ok(true, 'fires rerender event');
            t.end();
        });

        source.onAdd(map);
    });

    t.test('can be static', (t) => {
        const source = createSource({
            animate: false
        });
        const map = new StubMap();

        map.on('rerender', () => {
            t.notOk(true, 'shouldn\'t rerender here');
            t.end();
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                t.ok(true, 'fires load event without rerendering');
                t.end();
            }
        });

        source.onAdd(map);
    });

    t.test('onRemove stops animation', (t) => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        t.equal(source.hasTransition(), true, 'should animate initally');

        source.onRemove();

        t.equal(source.hasTransition(), false, 'should stop animating');

        source.onAdd(map);

        t.equal(source.hasTransition(), true, 'should animate when added again');

        t.end();
    });

    t.test('play and pause animation', (t) => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        t.equal(source.hasTransition(), true, 'initially animating');

        source.pause();

        t.equal(source.hasTransition(), false, 'can be paused');

        source.play();

        t.equal(source.hasTransition(), true, 'can be played');

        t.end();
    });

    t.end();
});

test('CanvasSource#serialize', (t) => {
    const source = createSource();

    const serialized = source.serialize();
    t.equal(serialized.type, 'canvas');
    t.deepEqual(serialized.coordinates, [[0, 0], [1, 0], [1, 1], [0, 1]]);

    window.restore();

    t.end();
});
