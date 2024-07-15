// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
// eslint-disable-next-line import/no-unresolved
import rawTileData from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import {loadVectorTile, DedupedRequest} from '../../../src/source/load_vector_tile';

const scheduler = {add: () => {}};

test('loadVectorTile does not make array buffer request for duplicate tile requests', () => {
    const deduped = new DedupedRequest(scheduler);
    const params = {request: {url: 'http://localhost:2900/fake.pbf'}};
    expect.assertions(1);
    const arrayBufRequester = () => () => {
        expect(true).toBeTruthy();
    };
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
});

// Handles 300 concurrent requests through queue

test('only processes concurrent requests up to the queue limit', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(scheduler);
    expect.assertions(49);
    const arrayBufRequester = () => {
        return () => {
            setTimeout(() => {
                expect(true).toBeTruthy();
            }, 1500);
        };
    };

    for (let i = 0; i < 300; i++) {
        loadVectorTile({request: {url: i}}, () => {}, deduped, false, arrayBufRequester);
    }
    vi.advanceTimersByTime(1500);
    vi.useRealTimers();
});
// Fails to fetch if concurrent requests get too large when unqueued
// Some stuff about cancelling within the queue?