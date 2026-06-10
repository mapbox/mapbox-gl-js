import {test, expect} from '../../util/vitest';
import '../../../src/util/worker_pool_factory';
import MapWorker from '../../../src/source/worker';

import type {OverscaledTileID} from '../../../src/source/tile_id';
import type {WorkerSourceConstructor, WorkerSource} from '../../../src/source/worker_source';

const _self = {
    addEventListener() {}
} as unknown as Worker;

test('isolates different instances\' data', () => {
    const worker = new MapWorker(_self);

    worker.setLayers(0, {layers: [{id: 'one', type: 'background'}], scope: '', options: new Map()});
    worker.setLayers(1, {layers: [{id: 'one', type: 'background'}, {id: 'two', type: 'background'}], scope: '', options: new Map()});

    expect(worker.layerIndexes[0]).not.toEqual(worker.layerIndexes[1]);
});

test('worker source messages dispatched to the correct map instance', () => {
    const worker = new MapWorker(_self);

    (worker.actor.send as any) = async (type: string, _data: unknown, options: {targetMapId?: number}) => {
        expect(type).toEqual('main thread task');
        expect(options.targetMapId).toEqual(999);
        return Promise.resolve();
    };

    _self.registerWorkerSource('test', function (this: WorkerSource, {actor}) {
        this.loadTile = async function () {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await actor.send('main thread task', {});
        };
    } as unknown as WorkerSourceConstructor);

    worker.loadTile(999, {
        uid: 0,
        type: 'test',
        source: 'source',
        scope: 'scope',
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0}} as OverscaledTileID
    });
});

test('worker sources should be scoped', () => {
    const worker = new MapWorker(_self);

    _self.registerWorkerSource('sourceType', function () {} as unknown as WorkerSourceConstructor);

    const a = worker.getWorkerSource(999, {type: 'sourceType', source: 'sourceId', scope: 'scope1', uid: 0});
    const b = worker.getWorkerSource(999, {type: 'sourceType', source: 'sourceId', scope: 'scope2', uid: 0});

    expect(a).not.toBe(b);
});
