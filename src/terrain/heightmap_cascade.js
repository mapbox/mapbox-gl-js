// @flow
import type Transform from '../geo/transform';
import type MercatorCoordinate from '../geo/mercator_coordinate';
import type Painter from '../render/painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';
import {distanceToLine, nextPowerOfTwo} from '../util/util';
import Point from '@mapbox/point-geometry';
import {mat4, vec3} from 'gl-matrix';
import {array as interpolate} from '../style-spec/util/interpolate';
import Framebuffer from '../gl/framebuffer';
import Texture from '../render/texture';
import assert from 'assert';
import DepthMode from '../gl/depth_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import { terrainHeightUniformValues } from './terrain_raster_program';
import StencilMode from '../gl/stencil_mode';

const NEAR_THRESHOLD_MAX = 1 / Math.cos(Math.PI / 4);
const NEAR_THRESHOLD_MIN = 0.1;

export class HeightmapCascade {
    nearCascadeMatrix: Float64Array;
    farCascadeMatrix: Float64Array;
    needsFarCascade: boolean;

    currNearSize: number;
    _nearFBO: Framebuffer;
    _nearTexture: Texture;
    _farFBO: Framebuffer;
    _farTexture: Texture;

    constructor() {
        this.nearCascadeMatrix = new Float64Array(16);
        this.farCascadeMatrix = new Float64Array(16);
        this.needsFarCascade = false;
        this.currNearSize = 512;
    }

    get currFarSize(): number {
        return this.currNearSize / 2;
    }

    calculateMatrices(transform: Transform) {
        const {x, y} = transform.point;
        const worldSize = transform.worldSize;
        const toPixels = (coord: MercatorCoordinate): vec3 => [coord.x * worldSize, coord.y * worldSize, 0];

        const horizon = transform.horizonLineFromTop();
        const topLeft = toPixels(transform.pointCoordinate(new Point(0, horizon)));
        const topRight = toPixels(transform.pointCoordinate(new Point(transform.width, horizon)));
        const btmLeft = toPixels(transform.pointCoordinate(new Point(0, transform.height)));
        const btmRight = toPixels(transform.pointCoordinate(new Point(transform.width, transform.height)));

        const top = distanceToLine(topLeft, topRight, [0, 0, 0]);
        const btm = distanceToLine(btmLeft, btmRight, [0, 0, 0]);

        const nearCascadeHeight = transform.height * NEAR_THRESHOLD_MAX;
        const nearCascadeExtent = Math.max(Math.min(nearCascadeHeight / Math.abs(btm - top), 1), NEAR_THRESHOLD_MIN);
        this.needsFarCascade = nearCascadeExtent < 1;

        const midLeft = interpolate(btmLeft, topLeft, nearCascadeExtent);
        const midRight = interpolate(btmRight, topRight, nearCascadeExtent);
        this._matrixFromTrapezoid(this.nearCascadeMatrix, transform.angle, midLeft, midRight, btmLeft, btmRight);

        if (this.needsFarCascade) {
            this._matrixFromTrapezoid(this.farCascadeMatrix, transform.angle, topLeft, topRight, midLeft, midRight);
        }
    }

    draw(terrain: Terrain, painter: Painter, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
        this.calculateMatrices(painter.transform);

        // Initialize FBOS
        this._setupFBOs(painter);
        const transform = painter.transform;
        const context = painter.context;
        const gl = context.gl;

        //Draw near FBO
        assert(this._nearFBO);
        assert(this._nearTexture);

        gl.bindTexture(gl.TEXTURE_2D, this._nearFBO.colorAttachment.get());
        context.bindFramebuffer.set(this._nearFBO.framebuffer);
        context.viewport.set([0, 0, this.currNearSize, this.currNearSize]);

        const program = painter.useProgram('terrainHeight');
        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);

            const matrix = mat4.multiply([], this.nearCascadeMatrix, transform.calcTranslationScaleMatrix(coord.toUnwrapped()));
            const uniformValues = terrainHeightUniformValues(matrix);
            terrain.setupElevationDraw(tile, program);
            program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled,
                uniformValues, "terrain_height", painter.debugBuffer, painter.quadTriangleIndexBuffer, painter.debugSegments);
        }

        if(this.needsFarCascade) {
            //Draw far FBO
            assert(this._farFBO);
            assert(this._farTexture);

            gl.bindTexture(gl.TEXTURE_2D, this._farFBO.colorAttachment.get());
            context.bindFramebuffer.set(this._farFBO.framebuffer);
            context.viewport.set([0, 0, this.currFarSize, this.currFarSize]);

            for (const coord of tileIDs) {
                const tile = sourceCache.getTile(coord);

                const matrix = mat4.multiply([], this.farCascadeMatrix, transform.calcTranslationScaleMatrix(coord.toUnwrapped()));
                const uniformValues = terrainHeightUniformValues(matrix);
                terrain.setupElevationDraw(tile, program);
                program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled,
                    uniformValues, "terrain_height", painter.debugBuffer, painter.quadTriangleIndexBuffer, painter.debugSegments);
            }
        }

        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);
    }

    _setupFBOs(painter: Painter) {
        const context = painter.context;
        const gl = context.gl;

        const nearSize = nextPowerOfTwo(painter.width);
        if (this._nearFBO && nearSize !== this.currNearSize) {
            this._nearTexture.destroy();
            this._nearFBO.destroy();
            delete this._nearFBO;
            delete this._nearTexture;

            if (this._farFBO) {
                this._farTexture.destroy();
                this._farFBO.destroy();

                delete this._farFBO;
                delete this._farTexture;
            }
        }

        if (!this._nearFBO) {
            context.activeTexture.set(gl.TEXTURE2);
            const texture = new Texture(context, {width: nearSize, height: nearSize, data: null}, gl.RGBA);
            texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            const fbo = context.createFramebuffer(nearSize, nearSize, false);
            fbo.colorAttachment.set(texture.texture);

            this._nearFBO = fbo;
            this._nearTexture = texture;
            this.currNearSize = nearSize;
        }

        if (!this._farFBO && this.needsFarCascade) {
            const farSize = this.currFarSize;
            const fbo = context.createFramebuffer(farSize, farSize, false);
            const texture = new Texture(context, {width: farSize, height: farSize, data: null}, gl.RGBA);
            texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            context.activeTexture.set(gl.TEXTURE3);
            fbo.colorAttachment.set(texture.texture);

            this._farFBO = fbo;
            this._farTexture = texture;
        }

    }

    _matrixFromTrapezoid(out: Float64Array, angle: Number, topLeft: vec3, topRight: vec3, btmLeft: vec3, btmRight: vec3) {
        const center = vec3.add([], [0, 0, 0], topLeft);
        vec3.add(center, center, topRight);
        vec3.add(center, center, btmLeft);
        vec3.add(center, center, btmRight);
        vec3.scale(center, center, 1 / 4);

        const n = vec3.sub([], topRight, topLeft);
        vec3.normalize(n, n);

        const top = Math.abs(distanceToLine(topLeft, topRight, center));
        const btm = Math.abs(distanceToLine(btmLeft, btmRight, center));
        const left = Math.abs(vec3.dot(vec3.sub([], center, topLeft), n));
        const right = Math.abs(vec3.dot(vec3.sub([], center, topRight), n));

        const m = mat4.ortho(out, -left, right, -btm, top, 0, 1);
        mat4.scale(m, m, [1, -1, 1]);
        mat4.rotateZ(m, m, angle);

        vec3.scale(center, center, -1);
        mat4.translate(m, m, center);
    }
}