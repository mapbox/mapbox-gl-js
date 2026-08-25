/**
 * An object that the map uses to schedule and cancel animation frames.
 *
 * When passed as {@link MapOptions.animationFrameProvider}, the map schedules
 * repaints through `provider.requestAnimationFrame` instead of
 * `window.requestAnimationFrame`. The map draws nothing until the host
 * application runs the queued callback.
 *
 * @example Driving the render loop from React
 * ```ts
 * let pending: FrameRequestCallback | null = null;
 * const map = new mapboxgl.Map({
 *     container: 'map',
 *     style: '...',
 *     animationFrameProvider: {
 *         requestAnimationFrame: (cb) => { pending = cb; return 1; },
 *         cancelAnimationFrame: () => { pending = null; },
 *     },
 * });
 * // Run the pending frame after every React commit
 * useEffect(() => { pending?.(performance.now()); pending = null; });
 * ```
 */
export type AnimationFrameProvider = {
    /**
     * Schedules the map's render function. The provider may run the callback
     * synchronously, before this call returns.
     *
     * @param callback The map's render function.
     * @returns A handle the map passes back to `cancelAnimationFrame`.
     */
    requestAnimationFrame: (callback: FrameRequestCallback) => number;

    /**
     * Cancels a scheduled frame. The map calls this when it no longer needs
     * the pending frame, for example on `map.remove()`. The handle may belong
     * to a callback that already ran or is still running; treat that as a no-op.
     *
     * @param handle The handle returned by `requestAnimationFrame`.
     */
    cancelAnimationFrame: (handle: number) => void;
};
