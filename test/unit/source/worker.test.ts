import {test, expect} from '../../util/vitest';
import '../../../src/util/worker_pool_factory';
import MapWorker from '../../../src/source/worker';
import {LocalGlyphMode} from '../../../src/render/local_glyph_rasterizer';

import type VectorTileWorkerSource from '../../../src/source/vector_tile_worker_source';
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

    worker.workerSourceTypes['vector'] = function (this: WorkerSource, {actor}) {
        this.loadTile = async function () {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await actor.send('main thread task', {});
        };
    } as unknown as WorkerSourceConstructor;

    worker.loadTile(999, {
        uid: 0,
        type: 'vector',
        source: 'source',
        scope: 'scope',
        tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0}} as OverscaledTileID
    });
});

test('worker sources should be scoped', () => {
    const worker = new MapWorker(_self);

    worker.workerSourceTypes['vector'] = function () {} as unknown as WorkerSourceConstructor;

    const a = worker.getWorkerSource(999, {type: 'vector', source: 'sourceId', scope: 'scope1'});
    const b = worker.getWorkerSource(999, {type: 'vector', source: 'sourceId', scope: 'scope2'});

    expect(a).not.toBe(b);
});

test('removeSource discards the worker source instance', async () => {
    const worker = new MapWorker(_self);

    worker.workerSourceTypes['vector'] = function () {} as unknown as WorkerSourceConstructor;
    worker.getWorkerSource(999, {type: 'vector', source: 'sourceId', scope: 'scope'});

    await worker.removeSource(999, {type: 'vector', source: 'sourceId', scope: 'scope'});

    expect(worker.getExistingWorkerSource(999, {type: 'vector', source: 'sourceId', scope: 'scope'})).toBeUndefined();
});

function getVectorSourceGlyphs(worker: MapWorker, mapId: number) {
    const source = worker.getWorkerSource(mapId, {type: 'vector', source: 'sourceId', scope: ''}) as VectorTileWorkerSource;
    return source.localGlyphs;
}

test('vector worker sources get the local glyph rasterizer from global params', () => {
    const worker = new MapWorker(_self);
    worker.setGlobalParams(0, {referrer: '', config: {}, localGlyphs: {mode: LocalGlyphMode.ideographs, fontFamily: 'sans-serif'}});

    expect(getVectorSourceGlyphs(worker, 0).fontFamily).toEqual('sans-serif');
});

test('clearCaches discards the local glyph rasterizer', () => {
    const worker = new MapWorker(_self);
    worker.setGlobalParams(0, {referrer: '', config: {}, localGlyphs: {mode: LocalGlyphMode.ideographs, fontFamily: 'sans-serif'}});
    worker.clearCaches(0, undefined);

    expect(getVectorSourceGlyphs(worker, 0)).toBeUndefined();
});
