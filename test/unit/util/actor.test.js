import {describe, test, expect} from "../../util/vitest.js";
import Actor from '../../../src/util/actor.js';

describe('Actor', () => {
    test('forwards responses to correct callback', async () => {
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) {
                this.listeners.push(listener);
            }

            postMessage({id, sourceMapId, type, data}) {
                this[type](sourceMapId, data, id);
            }
            test(mapId, data, id) {
                for (const listener of this.listeners) {
                    setTimeout(listener, 0, {data: {data, id, type: '<response>'}});
                }
            }
        }

        const worker = new WorkerStub();

        const m1 = new Actor(worker, {}, 1);
        const m2 = new Actor(worker, {}, 2);

        await new Promise(resolve => {
            m1.send('test', {value: 1729}, (err, response) => {
                expect(err).toBeFalsy();
                expect(response).toEqual({value: 1729});
            });
            m2.send('test', {value: 4104}, (err, response) => {
                expect(err).toBeFalsy();
                expect(response).toEqual({value: 4104});
                resolve();
            });

        });
    });

    test('targets worker-initiated messages to correct map instance', async () => {
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) {
                this.listeners.push(listener);
            }

            postMessage({id, sourceMapId, targetMapId, type, data}) {
                this[type](sourceMapId, data, id, type, targetMapId);
            }
            test(mapId, data, id, type, targetMapId) {
                for (const listener of this.listeners) {
                    setTimeout(listener, 0, {data: {data, id, type, targetMapId}});
                }
            }
        }

        const worker = new WorkerStub();
        const workerActor = new Actor(worker, {test() {}});

        await new Promise(resolve => {
            new Actor(worker, {
                test () {
                    resolve();
                }
            }, 1);
            new Actor(worker, {
                test () {
                    expect.unreachable();
                }
            }, 2);

            workerActor.send('test', {}, () => {}, 1);
        });
    });

    test('#remove unbinds event listener', () => {
        const actor = new Actor({
            addEventListener (type, callback, useCapture) {
                this._addEventListenerArgs = [type, callback, useCapture];
            },
            removeEventListener (type, callback, useCapture) {
                expect([type, callback, useCapture]).toEqual(this._addEventListenerArgs);
            }
        }, {}, null);
        actor.remove();
    });
});
