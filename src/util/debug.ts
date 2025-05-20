import {extend} from './util';
import assert from 'assert';
import {mat4, vec3} from 'gl-matrix';
import {aabbForTileOnGlobe} from '../geo/projection/globe_util';

import type {vec2} from 'gl-matrix';
import type Transform from '../geo/transform';
import type Painter from '../render/painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';
/**
 * This is a private namespace for utility functions that will get automatically stripped
 * out in production builds.
 *
 * @private
 */
export const Debug: {
    debugCanvas: HTMLCanvasElement | null | undefined;
    aabbCorners: Array<vec3>;
    extend: (...args: unknown[]) => void;
    run: (...args: unknown[]) => void;
    drawAabbs: (...args: unknown[]) => void;
    clearAabbs: (...args: unknown[]) => void;
    _drawBox: (...args: unknown[]) => void;
    _drawLine: (...args: unknown[]) => void;
    _drawQuad: (...args: unknown[]) => void;
    _initializeCanvas: (tr: Transform) => HTMLCanvasElement;
} =
{
    extend(dest: object, ...sources: Array<object | null | undefined>): object {
        return extend(dest, ...sources);
    },

    run(fn: () => unknown) {
        fn();
    },

    debugCanvas: null,
    aabbCorners: [],

    _initializeCanvas(tr: Transform) {
        if (!Debug.debugCanvas) {
            const canvas = Debug.debugCanvas = document.createElement('canvas');
            if (document.body) document.body.appendChild(canvas);

            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.pointerEvents = 'none';

            const resize = () => {
                canvas.width = tr.width;
                canvas.height = tr.height;
            };
            resize();

            window.addEventListener("resize", resize);
        }
        return Debug.debugCanvas;
    },

    _drawLine(ctx: CanvasRenderingContext2D, start?: [number, number], end?: [number, number]) {
        if (!start || !end) return;
        ctx.moveTo(...start);
        ctx.lineTo(...end);
    },

    _drawQuad(ctx: CanvasRenderingContext2D, corners: Array<vec2 | null | undefined>) {
        Debug._drawLine(ctx, corners[0], corners[1]);
        Debug._drawLine(ctx, corners[1], corners[2]);
        Debug._drawLine(ctx, corners[2], corners[3]);
        Debug._drawLine(ctx, corners[3], corners[0]);
    },

    _drawBox(ctx: CanvasRenderingContext2D, corners: Array<vec3 | null | undefined>) {
        assert(corners.length === 8, `AABB needs 8 corners, found ${corners.length}`);
        ctx.beginPath();
        Debug._drawQuad(ctx, corners.slice(0, 4));
        Debug._drawQuad(ctx, corners.slice(4));
        Debug._drawLine(ctx, corners[0], corners[4]);
        Debug._drawLine(ctx, corners[1], corners[5]);
        Debug._drawLine(ctx, corners[2], corners[6]);
        Debug._drawLine(ctx, corners[3], corners[7]);
        ctx.stroke();
    },

    drawAabbs(painter: Painter, sourceCache: SourceCache, coords: Array<OverscaledTileID>) {
        const tr = painter.transform;

        const worldToECEFMatrix = mat4.invert(new Float64Array(16) as unknown as mat4, tr.globeMatrix);
        const ecefToPixelMatrix = mat4.multiply([] as unknown as mat4, tr.pixelMatrix, tr.globeMatrix);
        const ecefToCameraMatrix = mat4.multiply([] as unknown as mat4, tr._camera.getWorldToCamera(tr.worldSize, 1), tr.globeMatrix);

        if (!tr.freezeTileCoverage) {
            // @ts-expect-error - TS2322 - Type 'vec3[][]' is not assignable to type 'vec3[]'.
            Debug.aabbCorners = coords.map(coord => {
                // Get tile AABBs in world/pixel space scaled by worldSize
                const aabb = aabbForTileOnGlobe(tr, tr.worldSize, coord.canonical, false);
                const corners = aabb.getCorners();
                // Store AABBs as rectangular prisms in ECEF, this allows viewing them from other angles
                // when transform.freezeTileCoverage is enabled.
                for (const pos of corners) {
                    vec3.transformMat4(pos, pos, worldToECEFMatrix);
                }
                return corners;
            });
        }

        const canvas = Debug._initializeCanvas(tr);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tileCount = Debug.aabbCorners.length;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.lineWidth = 1.5;

        for (let i = 0; i <  tileCount; i++) {
            // @ts-expect-error - TS2345 - Argument of type '(ecef: any) => vec3' is not assignable to parameter of type '((value: number, index: number, array: Float32Array) => number) & ((value: number, index: number, array: number[]) => vec3)'.
            const pixelCorners = Debug.aabbCorners[i].map(ecef => {
                // Clipping to prevent visual artifacts.
                // We don't draw any lines if one of their points is behind the camera.
                // This means that AABBs close to the camera may appear to be missing.
                // (A more correct algorithm would shorten the line segments instead of removing them entirely.)
                // Full AABBs can be viewed by enabling `map.transform.freezeTileCoverage` and panning.
                const cameraPos = vec3.transformMat4([] as unknown as vec3, ecef, ecefToCameraMatrix);

                if (cameraPos[2] > 0) { return null; }

                return vec3.transformMat4([] as unknown as vec3, ecef, ecefToPixelMatrix);
            });
            ctx.strokeStyle = `hsl(${360 * i / tileCount}, 100%, 50%)`;
            Debug._drawBox(ctx, pixelCorners);
        }
    },

    clearAabbs() {
        if (!Debug.debugCanvas) return;
        Debug.debugCanvas.getContext('2d').clearRect(0, 0, Debug.debugCanvas.width, Debug.debugCanvas.height);
        Debug.aabbCorners = [];
    }
};
