// @ts-nocheck
import {test, expect, vi, beforeEach} from '../../util/vitest';
// eslint-disable-next-line import/no-unresolved
import rawTileData from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import {loadVectorTile, DedupedRequest, resetRequestQueue} from '../../../src/source/load_vector_tile';

const createScheduler = () => ({add: () => {}});
const arrayBufDelay = 1500;
const maxRequests = 50;

beforeEach(() => {
    resetRequestQueue();
});

test('loadVectorTile does not make array buffer request for duplicate tile requests', () => {
    const deduped = new DedupedRequest(createScheduler());
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
    const deduped = new DedupedRequest(createScheduler());
    const reportingFunction = vi.fn();

    const delayedArrayBufRequesterWithCallback = () => {
        return (callback) => {
            setTimeout(() => {
                callback(null, {});
                reportingFunction();
            }, arrayBufDelay);
        };
    };

    for (let i = 0; i < 60; i++) {
        loadVectorTile({request: {url: i}}, () => {}, deduped, false, delayedArrayBufRequesterWithCallback);
    }
    vi.advanceTimersByTime(arrayBufDelay);
    expect(reportingFunction).toHaveBeenCalledTimes(maxRequests);
    vi.useRealTimers();
});

test('processes other items within the queue after earlier ones resolve', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());
    const reportingFunction = vi.fn();

    const delayedArrayBufRequesterWithCallback = ({requestParams}) => {
        return (callback) => {
            setTimeout(() => {
                reportingFunction(requestParams);
                callback(null, {});
                expect(true).toBeTruthy();
            }, arrayBufDelay);
        };
    };

    for (let i = 0; i < 300; i++) {
        loadVectorTile({request: {url: i}}, () => {}, deduped, false, delayedArrayBufRequesterWithCallback);
    }

    vi.advanceTimersByTime(arrayBufDelay);
    expect(reportingFunction).toHaveBeenCalledTimes(maxRequests);
    expect(reportingFunction).toHaveBeenLastCalledWith({url: maxRequests - 1});

    vi.advanceTimersByTime(arrayBufDelay);
    expect(reportingFunction).toHaveBeenCalledTimes(maxRequests * 2);
    expect(reportingFunction).toHaveBeenLastCalledWith({url: (maxRequests * 2) - 1});
    vi.useRealTimers();
});

// Fails to fetch if concurrent requests get too large when unqueued
// Some stuff about cancelling within the queue?
