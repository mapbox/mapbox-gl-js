import {describe, test, expect} from "../../util/vitest.js";
import '../../../src/util/global_worker_pool.js';
import Worker from '../../../src/source/worker.js';

const _self = {
    addEventListener() {}
};

describe('load tile', () => {
    test('calls callback on error', () => {
        const worker = new Worker(_self);
        worker.setProjection(0, {name: 'mercator'});
        worker.loadTile(0, {
            type: 'vector',
            source: 'source',
            scope: 'scope',
            uid: 0,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {x: 0, y: 0, z: 0, w: 0}},
            request: {url: '/error'}
        }, (err) => {
            expect(err).toBeTruthy();
        });
    });
});

test('isolates different instances\' data', () => {
    const worker = new Worker(_self);

    worker.setLayers(0, {layers: [
        {id: 'one', type: 'circle'}
    ], options: new Map()}, () => {});

    worker.setLayers(1, {layers: [
        {id: 'one', type: 'circle'},
        {id: 'two', type: 'circle'},
    ], options: new Map()}, () => {});

    expect(worker.layerIndexes[0]).not.toEqual(worker.layerIndexes[1]);
});

test('worker source messages dispatched to the correct map instance', () => {
    const worker = new Worker(_self);

    worker.actor.send = function (type, data, callback, mapId) {
        expect(type).toEqual('main thread task');
        expect(mapId).toEqual(999);
    };

    _self.registerWorkerSource('test', function(actor) {
        this.loadTile = function() {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            actor.send('main thread task', {}, () => {}, null);
        };
    });

    worker.loadTile(999, {type: 'test', source: 'source', scope: 'scope'});
});

test('worker sources should be scoped', () => {
    const worker = new Worker(_self);

    // eslint-disable-next-line prefer-arrow-callback
    _self.registerWorkerSource('sourceType', function() {});

    const a = worker.getWorkerSource(999, 'sourceType', 'sourceId', 'scope1');
    const b = worker.getWorkerSource(999, 'sourceType', 'sourceId', 'scope2');

    expect(a).not.toBe(b);
});
