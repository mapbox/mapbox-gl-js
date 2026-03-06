// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import {DedupedRequest, loadVectorTile} from '../../../src/source/load_vector_tile';

describe('loadVectorTile', () => {
    test('converts AJAXError(404) to null result', async () => {
        expect.assertions(2);

        mockFetch({
            'http://example.com/0/0/0.pbf': () => new Response('', {status: 404, statusText: 'Not Found'})
        });

        const deduped = new DedupedRequest();
        const params = {
            request: {url: 'http://example.com/0/0/0.pbf'},
            uid: 1,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {z: 0, x: 0, y: 0}},
            tileZoom: 0,
            zoom: 0,
        };

        await new Promise<void>((resolve) => {
            loadVectorTile.call({deduped}, params, (err, data) => {
                expect(err).toBe(null);
                expect(data).toBe(null);
                resolve();
            });
        });
    });

    test('passes through non-404 errors', async () => {
        expect.assertions(2);

        mockFetch({
            'http://example.com/0/0/0.pbf': () => new Response('', {status: 500, statusText: 'Server Error'})
        });

        const deduped = new DedupedRequest();
        const params = {
            request: {url: 'http://example.com/0/0/0.pbf'},
            uid: 1,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {z: 0, x: 0, y: 0}},
            tileZoom: 0,
            zoom: 0,
        };

        await new Promise<void>((resolve) => {
            loadVectorTile.call({deduped}, params, (err, data) => {
                expect(err).toBeTruthy();
                expect(err.status).toBe(500);
                resolve();
            });
        });
    });

});
