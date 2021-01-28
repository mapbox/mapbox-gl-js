// @flow
import window from './window.js';

let supportsOffscreenCanvas: ?boolean;

export default function offscreenCanvasSupported(): boolean {
    if (supportsOffscreenCanvas == null) {
        supportsOffscreenCanvas = window.OffscreenCanvas &&
            new window.OffscreenCanvas(1, 1).getContext('2d') &&
            typeof window.createImageBitmap === 'function';
    }

    return supportsOffscreenCanvas;
}
