import {describe, test, expect, createMap, vi} from '../../../util/vitest';

import type {AnimationFrameProvider} from '../../../../src/ui/animation_frame_provider';

/**
 * Build a manual animation-frame provider. Frames queued via
 * `provider.requestAnimationFrame` do not fire until the test calls
 * `provider.drain()` — proving the map's paint scheduling is fully owned by the host.
 */
function makeManualProvider() {
    let nextId = 1;
    const pending = new Map<number, FrameRequestCallback>();
    const provider: AnimationFrameProvider & {
        drain: (ts?: number) => number;
        pendingCount: () => number;
    } = {
        requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
            const id = nextId++;
            pending.set(id, cb);
            return id;
        }),
        cancelAnimationFrame: vi.fn((id: number) => {
            pending.delete(id);
        }),
        drain(ts = performance.now()) {
            const callbacks = [...pending.values()];
            pending.clear();
            for (const cb of callbacks) cb(ts);
            return callbacks.length;
        },
        pendingCount() {
            return pending.size;
        },
    };
    return provider;
}

describe('Map AnimationFrameProvider', () => {
    test('routes triggerRepaint through the provider when set', () => {
        const provider = makeManualProvider();
        const map = createMap({animationFrameProvider: provider});

        // The map's initial setStyle / resize should have queued at least one
        // frame via the provider (not via window.requestAnimationFrame).
        expect(provider.requestAnimationFrame).toHaveBeenCalled();

        map.remove();
    });

    test('no frame drains without host-driven callback', () => {
        const provider = makeManualProvider();
        const map = createMap({animationFrameProvider: provider});
        const renderSpy = vi.spyOn(map, '_render').mockImplementation(() => {});

        map.triggerRepaint();
        // We have NOT called provider.drain() — the map should not have rendered.
        expect(renderSpy).not.toHaveBeenCalled();
        expect(provider.pendingCount()).toBeGreaterThan(0);

        map.remove();
    });

    test('host draining the callback invokes _render exactly once', () => {
        const provider = makeManualProvider();
        const map = createMap({animationFrameProvider: provider});
        const renderSpy = vi.spyOn(map, '_render').mockImplementation(() => {});

        map.triggerRepaint();
        expect(renderSpy).not.toHaveBeenCalled();

        provider.drain();
        expect(renderSpy).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('map.remove() cancels pending frame via provider.cancelAnimationFrame', () => {
        const provider = makeManualProvider();
        const map = createMap({animationFrameProvider: provider});
        map.triggerRepaint();
        const cancelSpy = provider.cancelAnimationFrame as ReturnType<typeof vi.fn>;
        const before = cancelSpy.mock.calls.length;

        map.remove();

        expect(cancelSpy.mock.calls.length).toBeGreaterThan(before);
    });

    test('map with no custom rAF provider schedules default rAF', () => {
        // With no provider configured, scheduling must fall back to the
        // browser's native requestAnimationFrame - the map's initial
        // setStyle/resize should schedule its first frame this way.
        const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
        const map = createMap();
        expect(rafSpy).toHaveBeenCalled();
        rafSpy.mockRestore();

        map.remove();
    });

    test('a provider that throws once during render recovers on the next triggerRepaint instead of freezing', () => {
        // Regression test: `_frame` must be cleared even when _render() throws,
        // or every future triggerRepaint() is a no-op and the map never renders again.
        const provider = makeManualProvider();
        const map = createMap({animationFrameProvider: provider});

        let shouldThrow = true;
        const renderSpy = vi.spyOn(map, '_render').mockImplementation(() => {
            if (shouldThrow) {
                shouldThrow = false;
                throw new Error('boom');
            }
        });

        map.triggerRepaint();
        expect(() => provider.drain()).toThrow('boom');

        map.triggerRepaint();
        provider.drain();

        expect(renderSpy).toHaveBeenCalledTimes(2);

        map.remove();
    });

    test('a provider that invokes its callback synchronously does not recurse unboundedly under continuous repaint', async () => {
        const MAX_ITERATIONS = 30;
        let renderCount = 0;

        const syncProvider: AnimationFrameProvider = {
            requestAnimationFrame: (cb: FrameRequestCallback) => {
                cb(performance.now());
                return 1;
            },
            cancelAnimationFrame: () => {}
        };

        const map = createMap({animationFrameProvider: syncProvider});
        vi.spyOn(map, '_render').mockImplementation(() => {
            renderCount++;
            // Simulate a custom layer requesting continuous repaint from within render().
            if (renderCount < MAX_ITERATIONS) map.triggerRepaint();
        });

        expect(() => map.triggerRepaint()).not.toThrow();

        // Let the deferred microtasks (one per re-entrant frame) drain. Each
        // frame only schedules its follow-up microtask once the previous one
        // has run, so these awaits must happen sequentially, not in parallel.
        for (let i = 0; i < MAX_ITERATIONS + 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }

        expect(renderCount).toBe(MAX_ITERATIONS);

        map.remove();
    });

    test('a synchronous provider keeps rendering after a steady-state (non-continuous) frame', async () => {
        // A provider that invokes its callback synchronously and inline.
        const syncProvider: AnimationFrameProvider = {
            requestAnimationFrame: (cb: FrameRequestCallback) => { cb(performance.now()); return 1; },
            cancelAnimationFrame: () => {}
        };

        const map = createMap({animationFrameProvider: syncProvider});
        // Steady state: a render does NOT request another frame (static scene,
        // or the final frame of any animation).
        const renderSpy = vi.spyOn(map, '_render').mockImplementation(() => {});

        // Let any frames/microtasks queued during construction settle first,
        // so they don't affect the call counts measured below.
        for (let i = 0; i < 5; i++) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }
        renderSpy.mockClear();

        // Each repaint must render, one after another.
        map.triggerRepaint();
        map.triggerRepaint();
        map.triggerRepaint();
        map.triggerRepaint();

        expect(renderSpy).toHaveBeenCalledTimes(4);

        map.remove();
    });
});
