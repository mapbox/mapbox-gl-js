// @flow
import {extend} from './util.js';
import window from './window.js';
import assert from 'assert';
import {mat4, vec3} from 'gl-matrix';
import {aabbForTileOnGlobe} from '../geo/projection/globe_util.js';

import type {Vec2, Vec3} from 'gl-matrix';
import type Transform from '../geo/transform.js';
import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import type {OverscaledTileID} from '../source/tile_id.js';
/**
 * This is a private namespace for utility functions that will get automatically stripped
 * out in production builds.
 *
 * @private
 */
export const Debug: {
    debugCanvas: ?HTMLCanvasElement,
    aabbCorners: Array<Vec3>,
    extend: Function,
    run: Function,
    logToElement: Function,
    drawAabbs: Function,
    clearAabbs: Function
} =
{
    extend(dest: Object, ...sources: Array<?Object>): Object {
        return extend(dest, ...sources);
    },

    run(fn: () => any) {
        fn();
    },

    logToElement(message: string, overwrite: boolean = false, id: string = "log") {
        const el = window.document.getElementById(id);
        if (el) {
            if (overwrite) el.innerHTML = '';
            el.innerHTML += `<br>${message}`;
        }

    },

    debugCanvas: null,
    aabbCorners: [],

    _initializeCanvas(tr: Transform) {
        if (!this.debugCanvas) {
            this.debugCanvas = window.document.createElement('canvas');
            window.document.body.appendChild(this.debugCanvas);
            this.debugCanvas.style.position = 'absolute';
            this.debugCanvas.style.left = 0;
            this.debugCanvas.style.top = 0;
            this.debugCanvas.style.pointerEvents = 'none';

            const resize = () => {
                if (!this.debugCanvas) { return; }
                this.debugCanvas.width = tr.width;
                this.debugCanvas.height = tr.height;
            };
            resize();

            window.addEventListener("resize", resize);
        }
        return this.debugCanvas;
    },

    _drawLine(ctx: CanvasRenderingContext2D, start: ?Vec2, end: ?Vec2) {
        if (!start || !end) { return; }
        ctx.moveTo(...start);
        ctx.lineTo(...end);
    },

    _drawQuad(ctx: CanvasRenderingContext2D, corners: Array<?Vec2>) {
        this._drawLine(ctx, corners[0], corners[1]);
        this._drawLine(ctx, corners[1], corners[2]);
        this._drawLine(ctx, corners[2], corners[3]);
        this._drawLine(ctx, corners[3], corners[0]);
    },

    _drawBox(ctx: CanvasRenderingContext2D, corners: Array<?Vec3>) {
        assert(corners.length === 8, `AABB needs 8 corners, found ${corners.length}`);
        ctx.beginPath();
        this._drawQuad(ctx, corners.slice(0, 4));
        this._drawQuad(ctx, corners.slice(4));
        this._drawLine(ctx, corners[0], corners[4]);
        this._drawLine(ctx, corners[1], corners[5]);
        this._drawLine(ctx, corners[2], corners[6]);
        this._drawLine(ctx, corners[3], corners[7]);
        ctx.stroke();
    },

    drawAabbs(painter: Painter, sourceCache: SourceCache, coords: Array<OverscaledTileID>) {
        const tr = painter.transform;

        const worldToECEFMatrix = mat4.invert(new Float64Array(16), tr.globeMatrix);
        const ecefToPixelMatrix = mat4.multiply([], tr.pixelMatrix, tr.globeMatrix);
        const ecefToCameraMatrix = mat4.multiply([],  tr._camera.getWorldToCamera(tr.worldSize, 1), tr.globeMatrix);

        if (!tr.freezeTileCoverage) {
            this.aabbCorners = coords.map(coord => {
                // Get tile AABBs in world/pixel space scaled by worldSize
                const aabb = aabbForTileOnGlobe(tr, tr.worldSize, coord.canonical);
                const corners = aabb.getCorners();
                // Store AABBs as rectangular prisms in ECEF, this allows viewing them from other angles
                // when transform.freezeTileCoverage is enabled.
                for (const pos of corners) {
                    vec3.transformMat4(pos, pos, worldToECEFMatrix);
                }
                return corners;
            });
        }

        const canvas = this._initializeCanvas(tr);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tileCount = this.aabbCorners.length;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.lineWidth = 1.5;

        for (let i = 0; i <  tileCount; i++) {
            const pixelCorners = this.aabbCorners[i].map(ecef => {
                // Clipping to prevent visual artifacts.
                // We don't draw any lines if one of their points is behind the camera.
                // This means that AABBs close to the camera may appear to be missing.
                // (A more correct algorithm would shorten the line segments instead of removing them entirely.)
                // Full AABBs can be viewed by enabling `map.transform.freezeTileCoverage` and panning.
                const cameraPos = vec3.transformMat4([], ecef, ecefToCameraMatrix);
                if (cameraPos[2] > 0) { return null; }
                return vec3.transformMat4([], ecef, ecefToPixelMatrix);
            });
            ctx.strokeStyle = `hsl(${360 * i / tileCount}, 100%, 50%)`;
            this._drawBox(ctx, pixelCorners);
        }
    },

    clearAabbs() {
        if (!this.debugCanvas) { return; }
        this.debugCanvas.getContext('2d').clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        this.aabbCorners = [];
    }

};
