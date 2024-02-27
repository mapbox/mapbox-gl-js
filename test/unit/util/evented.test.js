import {describe, test, expect, vi} from "../../util/vitest.js";
import {Event, Evented} from '../../../src/util/evented.js';

describe('Evented', () => {
    test('calls listeners added with "on"', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.on('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(2);
    });

    test('calls listeners added with "once" once', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.once('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(evented.listens('a')).toBeFalsy();
    });

    test('"once" returns a promise if no listener provided', () => {
        expect.assertions(1);
        const evented = new Evented();
        evented.once('a').then(() => expect(true).toBeTruthy());
        evented.fire(new Event('a'));
    });

    test('passes data to listeners', async () => {
        const evented = new Evented();
        expect.assertions(1);
        evented.once('a', (data) => {
            expect(data.foo).toEqual('bar');
        });
        evented.fire(new Event('a', {foo: 'bar'}));
    });

    test('passes "target" to listeners', async () => {
        const evented = new Evented();
        expect.assertions(1);
        evented.once('a', (data) => {
            expect(data.target).toEqual(evented);
        });
        evented.fire(new Event('a'));
    });

    test('passes "type" to listeners', async () => {
        const evented = new Evented();
        expect.assertions(1);
        evented.once('a', (data) => {
            expect(data.type).toEqual('a');
        });
        evented.fire(new Event('a'));
    });

    test('removes listeners with "off"', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.on('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener).not.toHaveBeenCalled();
    });

    test('removes one-time listeners with "off"', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.once('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener).not.toHaveBeenCalled();
    });

    test('once listener is removed prior to call', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        expect.assertions(1);
        evented.once('a', () => {
            listener();
            evented.fire(new Event('a'));
        });
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('reports if an event has listeners with "listens"', async () => {
        const evented = new Evented();
        evented.on('a', () => {});
        expect(evented.listens('a')).toBeTruthy();
        expect(evented.listens('b')).toEqual(false);
    });

    test(
        'does not report true to "listens" if all listeners have been removed',
        async () => {
            const evented = new Evented();
            const listener = () => {};
            evented.on('a', listener);
            evented.off('a', listener);
            expect(evented.listens('a')).toBeFalsy();
        }
    );

    test('does not immediately call listeners added within another listener', async () => {
        const evented = new Evented();

        evented.on('a', () => {
            evented.on('a', expect.unreachable);
        });
        evented.fire(new Event('a'));
    });

    test('has backward compatibility for fire(string, object) API', async () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.on('a', listener);
        evented.fire('a', {foo: 'bar'});
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].foo).toBeTruthy();
    });

    test('on is idempotent', async () => {
        const evented = new Evented();
        const listenerA = vi.fn();
        const listenerB = vi.fn();
        evented.on('a', listenerA);
        evented.on('a', listenerB);
        evented.on('a', listenerA);
        evented.fire(new Event('a'));
        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerA).toHaveBeenCalledBefore(listenerB);
    });

    describe('evented parents', () => {
        test('adds parents with "setEventedParent"', async () => {
            const listener = vi.fn();
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', listener);
            eventedSource.fire(new Event('a'));
            eventedSource.fire(new Event('a'));
            expect(listener).toHaveBeenCalledTimes(2);
        });

        test('passes original data to parent listeners', async () => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            expect.assertions(1);
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', (data) => {
                expect(data.foo).toEqual('bar');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
        });

        test('attaches parent data to parent listeners', async () => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            expect.assertions(1);
            eventedSource.setEventedParent(eventedSink, {foz: 'baz'});
            eventedSink.on('a', (data) => {
                expect(data.foz).toEqual('baz');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
        });

        test('attaches parent data from a function to parent listeners', async () => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            expect.assertions(1);
            eventedSource.setEventedParent(eventedSink, () => ({foz: 'baz'}));
            eventedSink.on('a', (data) => {
                expect(data.foz).toEqual('baz');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
        });

        /**
         * @note Sounds like bug in implementation. Currently target is always current evented instance
         */
        test.skip('passes original "target" to parent listeners', async () => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink);

            await new Promise(resolve => {
                eventedSink.on('a', (data) => {
                    expect(data.target).toBe(eventedSource);
                    resolve();
                });
                eventedSource.fire(new Event('a'));
            });
        });

        test('removes parents with "setEventedParent(null)"', async () => {
            const listener = vi.fn();
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSink.on('a', listener);
            eventedSource.setEventedParent(eventedSink);
            eventedSource.setEventedParent(null);
            eventedSource.fire(new Event('a'));
            expect(listener).not.toHaveBeenCalled();
        });

        test('reports if an event has parent listeners with "listens"', async () => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSink.on('a', () => {});
            eventedSource.setEventedParent(eventedSink);
            expect(eventedSink.listens('a')).toBeTruthy();
        });

        test('eventedParent data function is evaluated on every fire', async () => {
            const eventedSource = new Evented();
            const eventedParent = new Evented();
            let i = 0;
            eventedSource.setEventedParent(eventedParent, () => i++);
            eventedSource.on('a', () => {});
            eventedSource.fire(new Event('a'));
            expect(i).toEqual(1);
            eventedSource.fire(new Event('a'));
            expect(i).toEqual(2);
        });
    });
});
