import { test } from 'mapbox-gl-js-test';
import assert from 'assert';
import ImageSource from '../../../src/source/image_source';
import { Evented } from '../../../src/util/evented';
import Transform from '../../../src/geo/transform';
import { extend } from '../../../src/util/util';
import browser from '../../../src/util/browser';
import window from '../../../src/util/window';

function createSource(options) {
    options = extend({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    const source = new ImageSource('id', options, { send: function() {} }, options.eventedParent);
    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
    }

    _transformRequest(url) {
        return { url };
    }
}

test('ImageSource', (t) => {
    window.useFakeXMLHttpRequest();
    // stub this manually because sinon does not stub non-existent methods
    assert(!window.URL.createObjectURL);
    window.URL.createObjectURL = () => 'blob:';
    t.tearDown(() => delete window.URL.createObjectURL);
    // stub Image so we can invoke 'onload'
    // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c
    const img = {};
    t.stub(window, 'Image').returns(img);
    // fake the image request (sinon doesn't allow non-string data for
    // server.respondWith, so we do so manually)
    const requests = [];
    window.XMLHttpRequest.onCreate = req => { requests.push(req); };
    const respond = () => {
        const req = requests.shift();
        req.setStatus(200);
        req.response = new ArrayBuffer(1);
        req.onload();
        img.onload();
    };
    t.stub(browser, 'getImageData').callsFake(() => new ArrayBuffer(1));

    t.test('constructor', (t) => {
        const source = createSource({ url : '/image.png' });

        t.equal(source.minzoom, 0);
        t.equal(source.maxzoom, 22);
        t.equal(source.tileSize, 512);
        t.end();
    });

    t.test('fires dataloading event', (t) => {
        const source = createSource({ url : '/image.png' });
        source.on('dataloading', (e) => {
            t.equal(e.dataType, 'source');
            t.end();
        });
        source.onAdd(new StubMap());
        respond();
    });

    t.test('transforms url request', (t) => {
        const source = createSource({ url : '/image.png' });
        const map = new StubMap();
        const spy = t.spy(map, '_transformRequest');
        source.onAdd(map);
        respond();
        t.ok(spy.calledOnce);
        t.equal(spy.getCall(0).args[0], '/image.png');
        t.equal(spy.getCall(0).args[1], 'Image');
        t.end();
    });

    t.test('fires data event when content is loaded', (t) => {
        const source = createSource({ url : '/image.png' });
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                t.ok(typeof source.tileID == 'object');
                t.end();
            }
        });
        source.onAdd(new StubMap());
        respond();
    });

    t.test('fires data event when metadata is loaded', (t) => {
        const source = createSource({ url : '/image.png' });
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.end();
            }
        });
        source.onAdd(new StubMap());
        respond();
    });

    t.test('serialize url and coordinates', (t) => {
        const source = createSource({ url: '/image.png' });

        const serialized = source.serialize();
        t.equal(serialized.type, 'image');
        t.equal(serialized.url, '/image.png');
        t.deepEqual(serialized.coordinates, [[0, 0], [1, 0], [1, 1], [0, 1]]);

        t.end();
    });

    t.end();
});
