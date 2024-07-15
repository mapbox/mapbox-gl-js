import {test, expect, vi, beforeEach} from '../../util/vitest';
import {loadVectorTile, DedupedRequest, resetRequestQueue} from '../../../src/source/load_vector_tile';
import type {RequestedTileParameters} from 'src/source/worker_source';

const createScheduler = () => ({add: () => {}} as any);
const arrayBufDelay = 1500;
const maxRequests = 50;
const arrayBufResolutionSpy = vi.fn();

const cancellableDelayedArrayBufRequestMaker = ({requestParams}) => {
    return (callback) => {
        let cancelled = false;
        setTimeout(() => {
            if (!cancelled) {
                arrayBufResolutionSpy(requestParams);
            }
            callback(null, {});
        }, arrayBufDelay);
        return () => {
            cancelled = true;
        };
    };
};

const makeRequests = ({numberOfRequests, deduped}: {numberOfRequests: number, deduped: DedupedRequest}) => {
    for (let i = 0; i < numberOfRequests; i++) {
        loadVectorTile({request: {url: String(i)}} as RequestedTileParameters, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    }
};

beforeEach(() => {
    arrayBufResolutionSpy.mockRestore();
    resetRequestQueue();
});

test('loadVectorTile does not make array buffer request for duplicate tile requests', () => {
    const deduped = new DedupedRequest(createScheduler());
    const params = {request: {url: 'http://localhost:2900/fake.pbf'}} as RequestedTileParameters;
    expect.assertions(1);
    const arrayBufRequester = () => () => {
        expect(true).toBeTruthy();
    };
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
    loadVectorTile(params, () => {}, deduped, false, arrayBufRequester);
});

test('only processes concurrent requests up to the queue limit', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: 2 * maxRequests, deduped});

    vi.advanceTimersByTime(arrayBufDelay);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(maxRequests);
    vi.useRealTimers();
});

test('processes other items within the queue after earlier ones resolve', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: 3 * maxRequests, deduped});

    vi.advanceTimersByTime(arrayBufDelay);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(maxRequests);
    expect(arrayBufResolutionSpy).toHaveBeenLastCalledWith({url: String(maxRequests - 1)});

    vi.advanceTimersByTime(arrayBufDelay);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(maxRequests * 2);
    expect(arrayBufResolutionSpy).toHaveBeenLastCalledWith({url: String((maxRequests * 2) - 1)});
    vi.useRealTimers();
});

test('entries that are cancelled whilst in the queue do not send array buffer requests', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: maxRequests, deduped});
    const cancel = loadVectorTile({request: {url: "abort"}} as RequestedTileParameters, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    cancel();

    vi.advanceTimersByTime(2 * arrayBufDelay);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(maxRequests);
    expect(arrayBufResolutionSpy).not.toHaveBeenCalledWith({url: "abort"});

    vi.useRealTimers();
});

test('entries cancelled outside the queue do not send array buffer requests', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    const cancel = loadVectorTile({request: {url: "abort"}} as RequestedTileParameters, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    cancel();

    vi.advanceTimersByTime(arrayBufDelay);
    expect(arrayBufResolutionSpy).not.toHaveBeenCalled();
    expect(arrayBufResolutionSpy).not.toHaveBeenCalledWith({url: "abort"});

    vi.useRealTimers();
});

// Fails to fetch if concurrent requests get too large when unqueued
