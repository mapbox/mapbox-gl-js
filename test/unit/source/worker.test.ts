import {describe, test, expect} from '../../util/vitest';
import '../../../src/util/worker_pool_factory';
import MapWorker from '../../../src/source/worker';

import type {OverscaledTileID} from '../../../src/source/tile_id';
import type {WorkerSourceConstructor} from '../../../src/source/worker_source';

const _self = {
    addEventListener() {}
} as unknown as Worker;

describe('load tile', () => {
    test('calls callback on error', () => {
        const worker = new MapWorker(_self);
        worker.setProjection(0, {name: 'mercator'});
        worker.loadTile(0, {
            type: 'vector',
            source: 'vector',
            scope: 'scope',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0}} as OverscaledTileID,
            request: {url: '/error'}
        }, (err) => {
            expect(err).toBeTruthy();
        });
    });
});

test('isolates different instances\' data', () => {
    const worker = new MapWorker(_self);

    worker.setLayers(0, {layers: [{id: 'one', type: 'background'}], scope: '', options: new Map()}, () => {});
    worker.setLayers(1, {layers: [{id: 'one', type: 'background'}, {id: 'two', type: 'background'}], scope: '', options: new Map()}, () => {});

    expect(worker.layerIndexes[0]).not.toEqual(worker.layerIndexes[1]);
});

test('worker source messages dispatched to the correct map instance', () => {
    const worker = new MapWorker(_self);

    worker.actor.send = function (type, data, callback, mapId) {
        expect(type).toEqual('main thread task');
        expect(mapId).toEqual(999);
        return {cancel: () => {}};
    };

    _self.registerWorkerSource('test', function (actor) {
        this.loadTile = function () {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            actor.send('main thread task', {}, () => {}, null);
        };
    } as unknown as WorkerSourceConstructor);

    worker.loadTile(999, {
        uid: 0,
        type: 'test',
        source: 'source',
        scope: 'scope',
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0}} as OverscaledTileID
    }, () => {});
});

test('worker sources should be scoped', () => {
    const worker = new MapWorker(_self);

    _self.registerWorkerSource('sourceType', function () {} as unknown as WorkerSourceConstructor);

    const a = worker.getWorkerSource(999, 'sourceType', 'sourceId', 'scope1');
    const b = worker.getWorkerSource(999, 'sourceType', 'sourceId', 'scope2');

    expect(a).not.toBe(b);
});
