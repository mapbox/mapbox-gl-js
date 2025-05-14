// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    describe,
    beforeEach,
    afterEach,
    test,
    expect,
    vi,
    waitFor,
    doneAsync,
} from '../../util/vitest';
import {mockFetch, getPNGResponse} from '../../util/network';
import ImageSource from '../../../src/source/image_source';
import {Evented} from '../../../src/util/evented';
import Transform from '../../../src/geo/transform';
import {extend} from '../../../src/util/util';
import browser from '../../../src/util/browser';
import {OverscaledTileID} from '../../../src/source/tile_id';
import Context from '../../../src/gl/context';

function createSource(options) {
    options = extend({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    const source = new ImageSource('id', options, {send() {}}, options.eventedParent);
    return source;
}

const canvas = window.document.createElement('canvas');

class StubMap extends Evented {
    constructor() {
        super();
        this.painter = {};
        this.painter.context = new Context(canvas.getContext('webgl2'));
        this.transform = new Transform();
        this._requestManager = {
            transformRequest: (url) => {
                return {url};
            }
        };
    }
}

describe('ImageSource', () => {
    const img: Record<string, any> = {};

    beforeEach(() => {
        window.URL.createObjectURL = () => 'blob:';
        vi.spyOn(window, 'Image').mockImplementation(() => img);
        vi.spyOn(browser, 'getImageData').mockImplementation(() => new ArrayBuffer(1));
    });

    afterEach(() => {
        delete window.URL.createObjectURL;
    });

    test('constructor', () => {
        const source = createSource({url: '/image.png'});

        expect(source.minzoom).toEqual(0);
        expect(source.maxzoom).toEqual(22);
        expect(source.tileSize).toEqual(512);
    });

    test('fires dataloading event', async () => {
        const {wait, withAsync} = doneAsync();
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.on('dataloading', withAsync((e, doneRef) => {
            expect(e.dataType).toEqual('source');
            doneRef.resolve();
        }));
        source.onAdd(new StubMap());
        await wait;
    });

    test('transforms url request', () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        const map = new StubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual('/image.png');
        expect(spy.mock.calls[0][1]).toEqual('Image');
    });

    test('updates url from updateImage', () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        const map = new StubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual('/image.png');
        expect(spy.mock.calls[0][1]).toEqual('Image');
        source.updateImage({url: '/image2.png'});
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0]).toEqual('/image2.png');
        expect(spy.mock.calls[1][1]).toEqual('Image');
    });

    test('sets coordinates', () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        const map = new StubMap();
        source.onAdd(map);
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.setCoordinates([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('sets coordinates via updateImage', async () => {
        const {wait, withAsync} = doneAsync();
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        const map = new StubMap();
        source.onAdd(map);
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);

        source.on('data', withAsync((e, doneRef) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                const afterSerialized = source.serialize();
                expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
                doneRef.resolve();
            }
        }));
        source.updateImage({
            url: '/image2.png',
            coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
        });
        await wait;
    });

    test('fires data event when content is loaded', async () => {
        const {wait, withAsync} = doneAsync();
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.on('data', withAsync((e, doneRef) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                expect(typeof source.tileID == 'object').toBeTruthy();
                doneRef.resolve();
            }
        }));
        source.onAdd(new StubMap());
        await wait;
    });

    test('fires data event when metadata is loaded', async () => {
        const {wait, withAsync} = doneAsync();
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.on('data', withAsync((e, doneRef) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                doneRef.resolve();
            }
        }));
        source.onAdd(new StubMap());
        await wait;
    });

    test('serialize url and coordinates', () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});

        const serialized = source.serialize();
        expect(serialized.type).toEqual('image');
        expect(serialized.url).toEqual('/image.png');
        expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    });

    test('https://github.com/mapbox/mapbox-gl-js/issues/12209', async () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.tiles[0] = new OverscaledTileID(0, 0, 0, 0, 0);
        const map = new StubMap();
        const coordinates = [[0, 0], [-1, 0], [-1, -1], [0, -1]];

        source.onAdd(map);
        expect(!source.loaded()).toBeTruthy();
        expect(!source._dirty).toBeTruthy();

        await waitFor(source, 'data');

        expect(source.loaded()).toBeTruthy();
        expect(source._dirty).toBeTruthy();
        expect(source.image).toBeTruthy();

        source.prepare();
        expect(source.texture).toBeTruthy();
        const spy = vi.spyOn(source.texture, 'update');

        source.prepare();
        expect(spy).not.toHaveBeenCalled();
        source.updateImage({url: '/image2.png', coordinates});

        await waitFor(source, 'data');

        source.prepare();
        expect(spy).toHaveBeenCalledTimes(1);
        source.prepare();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('reloading image retains loaded status', async () => {
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        const map = new StubMap();
        const coordinates = [[0, 0], [-1, 0], [-1, -1], [0, -1]];
        source.onAdd(map);
        expect(!source.loaded()).toBeTruthy();
        await waitFor(source, 'data');
        expect(source.loaded()).toBeTruthy();
        source.updateImage({url: '/image2.png', coordinates});
        await waitFor(source, 'data');
        expect(source.loaded()).toBeTruthy();
        source.updateImage({url: '/image.png', coordinates});
        await waitFor(source, 'data');
        expect(source.loaded()).toBeTruthy();
        source.updateImage({url: '/image2.png', coordinates});
        await waitFor(source, 'data');
    });

    test('cancels image request when onRemove is called', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.onAdd(new StubMap());
        source.onRemove();
        expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    test('cancels image request when updateImage is called', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/image.png'});
        source.image = img;
        source.onAdd(new StubMap());

        source.updateImage({url: '/image2.png'});

        expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    test('does not cancel image request when updateImage is called with the same url', () => {
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        mockFetch({
            '/image.png': async () => new Response(await getPNGResponse()),
        });
        const source = createSource({url: '/image.png'});
        source.image = img;
        source.onAdd(new StubMap());
        source.updateImage({url: '/image.png'});

        expect(abortSpy).not.toHaveBeenCalled();
    });

    test('updates image before first image was loaded', async () => {
        mockFetch({
            '/notfound.png': () => new Response(null, {status: 404}),
            '/image.png': async () => new Response(await getPNGResponse()),
            '/image2.png': async () => new Response(await getPNGResponse())
        });
        const source = createSource({url: '/notfound.png'});
        const map = new StubMap();
        const spy = vi.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        const {error} = await waitFor(source, 'error');
        expect(error.status).toBe(404);
        expect(source.image).toBeFalsy();
        source.updateImage({url: '/image2.png'});
        await waitFor(source, 'data');
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0]).toEqual('/image2.png');
        expect(spy.mock.calls[1][1]).toEqual('Image');
    });
});
