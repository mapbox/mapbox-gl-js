import {test, expect, vi, beforeEach} from '../../util/vitest';
import {loadVectorTile, DedupedRequest, resetRequestQueue} from '../../../src/source/load_vector_tile';
import type {RequestedTileParameters} from '../../../src/source/worker_source';

const createScheduler = () => ({add: () => {}} as any);
const ARRAY_BUF_DELAY = 1500;
const MAX_REQUESTS = 50;
const arrayBufResolutionSpy = vi.fn();

const cancellableDelayedArrayBufRequestMaker = ({requestParams}) => {
    return (callback) => {
        let cancelled = false;
        setTimeout(() => {
            if (!cancelled) {
                arrayBufResolutionSpy(requestParams);
            }
            callback(null, {});
        }, ARRAY_BUF_DELAY);
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
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());
    const params = {request: {url: 'http://localhost:2900/fake.pbf'}} as RequestedTileParameters;

    loadVectorTile(params, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    loadVectorTile(params, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    loadVectorTile(params, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);

    vi.advanceTimersByTime(ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
});

test('only processes concurrent requests up to the queue limit', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: 2 * MAX_REQUESTS, deduped});

    vi.advanceTimersByTime(ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(MAX_REQUESTS);
    vi.useRealTimers();
});

test('processes other items within the queue after earlier ones resolve', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: 3 * MAX_REQUESTS, deduped});

    vi.advanceTimersByTime(ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(arrayBufResolutionSpy).toHaveBeenLastCalledWith({url: String(MAX_REQUESTS - 1)});

    vi.advanceTimersByTime(ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(MAX_REQUESTS * 2);
    expect(arrayBufResolutionSpy).toHaveBeenLastCalledWith({url: String((MAX_REQUESTS * 2) - 1)});
    vi.useRealTimers();
});

test('entries that are cancelled whilst in the queue do not send array buffer requests', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    makeRequests({numberOfRequests: MAX_REQUESTS, deduped});
    const cancel = loadVectorTile({request: {url: "abort"}} as RequestedTileParameters, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    cancel();

    vi.advanceTimersByTime(2 * ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(arrayBufResolutionSpy).not.toHaveBeenCalledWith({url: "abort"});

    vi.useRealTimers();
});

test('entries cancelled outside the queue do not send array buffer requests', () => {
    vi.useFakeTimers();
    const deduped = new DedupedRequest(createScheduler());

    const cancel = loadVectorTile({request: {url: "abort"}} as RequestedTileParameters, () => {}, deduped, false, cancellableDelayedArrayBufRequestMaker);
    cancel();

    vi.advanceTimersByTime(ARRAY_BUF_DELAY);
    expect(arrayBufResolutionSpy).not.toHaveBeenCalled();
    expect(arrayBufResolutionSpy).not.toHaveBeenCalledWith({url: "abort"});

    vi.useRealTimers();
});
