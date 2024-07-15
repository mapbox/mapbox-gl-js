// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
// eslint-disable-next-line import/no-unresolved
import rawTileData from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import {loadVectorTile, DedupedRequest} from '../../../src/source/load_vector_tile';

const scheduler = {add: () => {}};

test('loadVectorTile does not make array buffer request for duplicate tile requests', () => {
    const deduped = new DedupedRequest(scheduler);
    const params = {url: 'http://localhost:2900/fake.pbf'};
    expect.assertions(1);
    const arrayBufRequester = () => () => {
        expect(true).toBeTruthy();
    };
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
});

// Handles 300 concurrent requests through queue
// Fails to fetch if concurrent requests get too large when unqueued
