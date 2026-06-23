// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import Actor from '../../../src/util/actor';

describe('Actor', () => {
    test('forwards responses to correct Promise', async () => {
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) {
                this.listeners.push(listener);
            }

            postMessage({id, sourceMapId, type, data}) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this[type](sourceMapId, data, id);
            }
            test(mapId, data, id) {
                for (const listener of this.listeners) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
                    setTimeout(listener, 0, {data: {data, id, type: '<response>'}});
                }
            }
        }

        const worker = new WorkerStub();

        const m1 = new Actor(worker, {}, 1);
        const m2 = new Actor(worker, {}, 2);

        const [r1, r2] = await Promise.all([
            m1.send('test', {value: 1729}),
            m2.send('test', {value: 4104}),
        ]);

        expect(r1).toEqual({value: 1729});
        expect(r2).toEqual({value: 4104});
    });

    test('targets worker-initiated messages to correct map instance', async () => {
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) {
                this.listeners.push(listener);
            }

            postMessage({id, sourceMapId, targetMapId, type, data}) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                if (this[type]) this[type](sourceMapId, data, id, type, targetMapId);
            }
            test(mapId, data, id, type, targetMapId) {
                for (const listener of this.listeners) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
                    setTimeout(listener, 0, {data: {data, id, type, targetMapId}});
                }
            }
        }

        const worker = new WorkerStub();
        const workerActor = new Actor(worker, {test() {}});

        await new Promise(resolve => {
            new Actor(worker, {
                test() {
                    resolve();
                }
            }, 1);
            new Actor(worker, {
                test() {
                    expect.unreachable();
                }
            }, 2);

            workerActor.send('test', {}, {targetMapId: 1});
        });
    });

    test('notify returns undefined, posts the message, and registers no pending response', () => {
        const postMessages = [];
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) { this.listeners.push(listener); }
            postMessage(msg) { postMessages.push(msg); }
        }

        const worker = new WorkerStub();
        const actor = new Actor(worker, {}, 1);

        const result = actor.notify('removeTile', {uid: 0});

        expect(result).toBeUndefined();
        expect(postMessages).toHaveLength(1);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(postMessages[0].type).toEqual('removeTile');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(postMessages[0].id).toBeUndefined();
        expect(actor.pendingResponses.size).toEqual(0);
    });

    test('a notify message (no id) skips the success response', async () => {
        const postMessages = [];
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) { this.listeners.push(listener); }
            postMessage(msg) { postMessages.push(msg); }
        }

        const worker = new WorkerStub();
        const actor = new Actor(worker, {removeTile() { return 'ok'; }}, 1);

        await actor.processTask(undefined, {type: 'removeTile', data: null});

        expect(postMessages).toHaveLength(0);
    });

    test('a notify handler error asserts, not posted back', async () => {
        const postMessages = [];
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) { this.listeners.push(listener); }
            postMessage(msg) { postMessages.push(msg); }
        }

        const worker = new WorkerStub();
        const actor = new Actor(worker, {removeTile() { throw new Error('boom'); }}, 1);

        await expect(actor.processTask(undefined, {type: 'removeTile', data: null}))
            .rejects.toThrow(/boom/);
        expect(postMessages).toHaveLength(0);
    });

    test('#remove unbinds event listener', () => {
        const actor = new Actor({
            addEventListener(type, callback, useCapture) {
                this._addEventListenerArgs = [type, callback, useCapture];
            },
            removeEventListener(type, callback, useCapture) {
                expect([type, callback, useCapture]).toEqual(this._addEventListenerArgs);
            }
        }, {}, null);
        actor.remove();
    });

    test('AbortSignal aborts a pending request — Promise rejects with AbortError, posts only the request', async () => {
        const postMessages = [];
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) { this.listeners.push(listener); }
            postMessage(msg) { postMessages.push(msg); }
        }

        const worker = new WorkerStub();
        const actor = new Actor(worker, {}, 1);

        const controller = new AbortController();
        const promise = actor.send('getGlyphs', {stacks: {}}, {signal: controller.signal});

        controller.abort();

        await expect(promise).rejects.toSatisfy(
            (err) => err instanceof DOMException && err.name === 'AbortError'
        );

        // Cancellation is caller-side only: aborting rejects the pending request and posts nothing
        // to the worker, so only the original getGlyphs request was ever sent.
        expect(postMessages).toHaveLength(1);
    });

    test('remove() rejects in-flight requests with AbortError', async () => {
        class WorkerStub {
            listeners = [];
            addEventListener(type, listener) { this.listeners.push(listener); }
            removeEventListener() {}
            postMessage() { /* never responds */ }
        }

        const worker = new WorkerStub();
        const actor = new Actor(worker, {}, 1);

        const promise = actor.send('getGlyphs', {stacks: {}});
        // Attach the rejection handler before remove() so the synchronous rejection is never unhandled.
        const assertion = expect(promise).rejects.toSatisfy(
            (err) => err instanceof DOMException && err.name === 'AbortError'
        );
        actor.remove();

        await assertion;
    });

});
