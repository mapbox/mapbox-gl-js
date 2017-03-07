'use strict';

const test = require('mapbox-gl-js-test').test;
const CanvasSource = require('../../../src/source/canvas_source');
const Transform = require('../../../src/geo/transform');
const Evented = require('../../../src/util/evented');
const util = require('../../../src/util/util');
const window = require('../../../src/util/window');

function createSource(options) {
    window.useFakeHTMLCanvasGetContext();

    const c = window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = util.extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    const source = new CanvasSource('id', options, { send: function() {} }, options.eventedParent);
    source.canvas = c;

    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this.style = { animationLoop: { set: function() {} } };
    }

    _rerender() {
        this.fire('rerender');
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

    t.end();
});

test('CanvasSource#serialize', (t) => {
    const source = createSource();

    const serialized = source.serialize();
    t.equal(serialized.type, 'canvas');
    t.ok(serialized.canvas);
    t.deepEqual(serialized.coordinates, [[0, 0], [1, 0], [1, 1], [0, 1]]);

    window.restore();

    t.end();
});
