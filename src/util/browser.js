// @flow strict
import assert from 'assert';
import window from './window.js';
import offscreenCanvasSupported from './offscreen_canvas_supported.js';
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

    /**
     * Returns true if the browser has OffscreenCanvas support and
     * adds noise to Canvas2D operations used for image decoding to prevent fingerprinting.
     */
    hasCanvasFingerprintNoise(): boolean {
        if (!offscreenCanvasSupported()) return false;
        assert(window.OffscreenCanvas, 'OffscreenCanvas is not supported');

        const offscreenCanvas = new window.OffscreenCanvas(255 / 3, 1);
        const offscreenCanvasContext = offscreenCanvas.getContext('2d', {willReadFrequently: true});
        let inc = 0;
        // getImageData is lossy with premultiplied alpha.
        for (let i = 0; i < offscreenCanvas.width; ++i) {
            offscreenCanvasContext.fillStyle = `rgba(${inc++},${inc++},${inc++}, 255)`;
            offscreenCanvasContext.fillRect(i, 0, 1, 1);
        }
        const readData = offscreenCanvasContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        inc = 0;
        for (let i = 0; i < readData.data.length; ++i) {
            if (i % 4 !== 3 && inc++ !== readData.data[i]) {
                return true;
            }
        }
        return false;
    }
};

export default exported;
