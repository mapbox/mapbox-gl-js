// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi, createMap} from '../../../util/vitest';
import {mockFetch, getPNGResponse} from '../../../util/network';

test('Map#loadImage resolves the image with a sync transform', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const transformRequest = vi.fn((url) => ({url}));
    const map = createMap({transformRequest});

    mockFetch({
        '/image.png': async () => new Response(await getPNGResponse())
    });

    const data = await new Promise((resolve, reject) => {
        map.loadImage('/image.png', (err, image) => {
            if (err) return reject(err);
            resolve(image);
        });
    });

    expect(transformRequest).toHaveBeenCalledWith('/image.png', 'Image', {});
    expect(data).toBeTruthy();
    map.remove();
});

test('Map#loadImage routes a rejecting transform to the callback', async () => {
    const transformError = new Error('nope');
    const transformRequest = vi.fn(() => { throw transformError; });
    const map = createMap({transformRequest});

    const err = await new Promise((resolve) => {
        map.loadImage('https://example.com/image.png', (error) => resolve(error));
    });

    expect(err).toEqual(transformError);
    map.remove();
});
