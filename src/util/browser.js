// @flow strict

import window from './window.js';
import type {Cancelable} from '../types/cancelable.js';

let linkEl;

let reducedMotionQuery: MediaQueryList;

let stubTime: number | void;

let canvas;

/**
 * @private
 */
const exported = {
    /**
     * Returns either performance.now() or a value set by setNow.
     * @returns {number} Time value in milliseconds.
     */
    now(): number {
        if (stubTime !== undefined) {
            return stubTime;
        }
        return window.performance.now();
    },
    setNow(time: number) {
        stubTime = time;
    },

    restoreNow() {
        stubTime = undefined;
    },

    frame(fn: (paintStartTimestamp: number) => void): Cancelable {
        const frame = window.requestAnimationFrame(fn);
        return {cancel: () => window.cancelAnimationFrame(frame)};
    },

    getImageData(img: CanvasImageSource, padding?: number = 0): ImageData {
        const {width, height} = img;

        if (!canvas) {
            canvas = window.document.createElement('canvas');
        }

        const context = canvas.getContext('2d', {willReadFrequently: true});
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }

        if (width > canvas.width || height > canvas.height) {
            canvas.width = width;
            canvas.height = height;
        }

        context.clearRect(-padding, -padding, width + 2 * padding, height + 2 * padding);
        context.drawImage(img, 0, 0, width, height);
        return context.getImageData(-padding, -padding, width + 2 * padding, height + 2 * padding);
    },

    resolveURL(path: string): string {
        if (!linkEl) linkEl = window.document.createElement('a');
        linkEl.href = path;
        return linkEl.href;
    },

    get devicePixelRatio(): number { return window.devicePixelRatio; },
    get prefersReducedMotion(): boolean {
        if (!window.matchMedia) return false;
        // Lazily initialize media query.
        if (reducedMotionQuery == null) {
            reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
        return reducedMotionQuery.matches;
    },
};

export default exported;
