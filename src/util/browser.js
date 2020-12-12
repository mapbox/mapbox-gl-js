// @flow strict

import window from './window';
import type {Cancelable} from '../types/cancelable';

let linkEl;

let reducedMotionQuery: MediaQueryList;

let errorState = false;

let stubTime;

/**
 * @private
 */
const exported = {
    /**
     * Returns either performance.now() or a value set by setNow.
     * @returns Time value in milliseconds.
     */
    now(): number {
        if (stubTime !== undefined) {
            return stubTime;
        }
        return window.performance.now();
    },

    setErrorState() {
        errorState = true;
    },

    setNow(time: number) {
        stubTime = time;
    },

    restoreNow() {
        stubTime = undefined;
    },

    frame(fn: (paintStartTimestamp: number) => void): Cancelable {
        if (errorState) return {cancel: () => {  }};
        const frame = window.requestAnimationFrame(fn);
        return {cancel: () => window.cancelAnimationFrame(frame)};
    },

    getImageData(img: CanvasImageSource, padding?: number = 0): ImageData {
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        return context.getImageData(-padding, -padding, img.width + 2 * padding, img.height + 2 * padding);
    },

    resolveURL(path: string) {
        if (!linkEl) linkEl = window.document.createElement('a');
        linkEl.href = path;
        return linkEl.href;
    },

    get devicePixelRatio() { return window.devicePixelRatio; },
    get prefersReducedMotion(): boolean {
        if (!window.matchMedia) return false;
        //Lazily initialize media query
        if (reducedMotionQuery == null) {
            reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
        return reducedMotionQuery.matches;
    },
};

export default exported;
