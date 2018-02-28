import { test } from 'mapbox-gl-js-test';
import ImageSource from '../../../src/source/image_source';
import { Evented } from '../../../src/util/evented';
import Transform from '../../../src/geo/transform';
import util from '../../../src/util/util';
import ajax from '../../../src/util/ajax';
import browser from '../../../src/util/browser';

function createSource(options) {
    options = util.extend({
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

    t.stub(ajax, 'getImage').callsFake((params, callback) => callback(null, {}));
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
    });

    t.test('transforms url request', (t) => {
        const source = createSource({ url : '/image.png' });
        const map = new StubMap();
        const spy = t.spy(map, '_transformRequest');
        source.onAdd(map);
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
    });

    t.test('fires data event when metadata is loaded', (t) => {
        const source = createSource({ url : '/image.png' });
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.end();
            }
        });
        source.onAdd(new StubMap());
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
