// @flow strict
let supportsOffscreenCanvas: ?boolean;

export default function offscreenCanvasSupported(): boolean {
    if (supportsOffscreenCanvas == null) {
        supportsOffscreenCanvas = self.OffscreenCanvas &&
            new OffscreenCanvas(1, 1).getContext('2d') &&
            typeof self.createImageBitmap === 'function';
    }

    return supportsOffscreenCanvas;
}
