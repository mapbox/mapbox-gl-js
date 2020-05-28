// @flow strict

declare class OffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number): OffscreenCanvas;
    getContext(contextType: '2d'): CanvasRenderingContext2D;
}
