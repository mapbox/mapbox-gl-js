// @flow
import Color from '../style-spec/util/color.js';

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import {default as ColorMode, ZERO, ONE, ONE_MINUS_SRC_ALPHA} from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {
    globeToMercatorTransition,
    globeUseCustomAntiAliasing
} from './../geo/projection/globe_util.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import {AtmosphereBuffer} from '../render/atmosphere_buffer.js';
import {degToRad, mapValue, clamp} from '../util/util.js';
import {mat3, vec3, mat4, quat} from 'gl-matrix';
import type {Vec3} from 'gl-matrix';
import Fog from '../style/fog.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import SegmentVector from '../data/segment.js';
import {TriangleIndexArray, StarsVertexArray} from '../data/array_types.js';
import {starsLayout} from './stars_attributes.js';
import {starsUniformValues} from '../terrain/stars_program.js';
import {mulberry32} from '../style-spec/util/random.js';
import type {DynamicDefinesType} from './program/program_uniforms.js';

function generateUniformDistributedPointsOnSphere(pointsCount: number): Array<Vec3> {
    const sRand = mulberry32(30);

    const points: Array<Vec3> = [];
    for (let i = 0; i < pointsCount; ++i) {
        const lon = 2 * Math.PI * sRand();
        const lat = Math.acos(1 - 2 * sRand()) - Math.PI * 0.5;

        points.push(vec3.fromValues(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)));
    }

    return points;
}

class Atmosphere {
    atmosphereBuffer: ?AtmosphereBuffer;
    starsVx: ?VertexBuffer;
    starsIdx: ?IndexBuffer;
    starsSegments: SegmentVector;
    colorModeAlphaBlendedWriteRGB: ColorMode;
    colorModeWriteAlpha: ColorMode;

    constructor() {
        this.colorModeAlphaBlendedWriteRGB = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, false]);
        this.colorModeWriteAlpha = new ColorMode([ONE, ZERO, ONE, ZERO], Color.transparent, [false, false, false, true]);
    }

    update(painter: Painter) {
        const context = painter.context;

        if (!this.atmosphereBuffer) {
            this.atmosphereBuffer = new AtmosphereBuffer(context);

            // Part of internal stlye spec, not exposed to gl-js
            const starsCount = 16000;
            const sizeRange = 100.0;
            const intensityRange = 200.0;

            const stars = generateUniformDistributedPointsOnSphere(starsCount);
            const sRand = mulberry32(300);

            const vertices = new StarsVertexArray();
            const triangles = new TriangleIndexArray();

            let base = 0;
            for (let i = 0; i < stars.length; ++i) {

                const star = vec3.scale([], stars[i], 200.0);

                const size = Math.max(0, 1.0 + 0.01 * sizeRange * (-0.5 + 1.0 * sRand()));
                const intensity = Math.max(0, 1.0 + 0.01 * intensityRange * (-0.5 + 1.0 * sRand()));

                vertices.emplaceBack(star[0], star[1], star[2], -1, -1, size, intensity);
                vertices.emplaceBack(star[0], star[1], star[2], 1, -1, size, intensity);
                vertices.emplaceBack(star[0], star[1], star[2], 1, 1, size, intensity);
                vertices.emplaceBack(star[0], star[1], star[2], -1, 1, size, intensity);

                triangles.emplaceBack(base + 0, base + 1, base + 2);
                triangles.emplaceBack(base + 0, base + 2, base + 3);

                base += 4;
            }

            this.starsVx = context.createVertexBuffer(vertices, starsLayout.members);
            this.starsIdx = context.createIndexBuffer(triangles);
            this.starsSegments = SegmentVector.simpleSegment(0, 0, vertices.length, triangles.length);
        }
    }

    destroy() {
        if (this.atmosphereBuffer) {
            this.atmosphereBuffer.destroy();
        }
        if (this.starsVx) {
            this.starsVx.destroy();
        }
        if (this.starsIdx) {
            this.starsIdx.destroy();
        }
    }

    drawAtmosphereGlow(painter: Painter, fog: Fog) {
        const context = painter.context;
        const gl = context.gl;
        const tr = painter.transform;
        const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);

        const transitionT = globeToMercatorTransition(tr.zoom);

        const fogColor = fog.properties.get('color').toArray01();
        const highColor = fog.properties.get('high-color').toArray01();
        const spaceColor = fog.properties.get('space-color').toArray01PremultipliedAlpha();

        // https://www.desmos.com/calculator/oanvvpr36d
        // Ensure horizon blend is 0-exclusive to prevent division by 0 in the shader
        const minHorizonBlend = 0.0005;
        const horizonBlend = mapValue(fog.properties.get('horizon-blend'), 0.0, 1.0, minHorizonBlend, 0.25);

        // Use a slightly smaller size of the globe to account for custom
        // antialiasing that reduces the size of the globe of two pixels
        // https://www.desmos.com/calculator/xpgmzghc37
        const globeRadius = globeUseCustomAntiAliasing(painter, context, tr) && horizonBlend === minHorizonBlend ?
            tr.worldSize / (2.0 * Math.PI * 1.025) - 1.0 : tr.globeRadius;

        const temporalOffset = (painter.frameCounter / 1000.0) % 1;
        const globeCenterInViewSpace = (((tr.globeCenterInViewSpace): any): Array<number>);
        const globeCenterDistance = vec3.length(globeCenterInViewSpace);
        const distanceToHorizon = Math.sqrt(Math.pow(globeCenterDistance, 2.0) - Math.pow(globeRadius, 2.0));
        const horizonAngle = Math.acos(distanceToHorizon / globeCenterDistance);

        const draw = (alphaPass: boolean) => {
            const defines = tr.projection.name === 'globe' ? ['PROJECTION_GLOBE_VIEW', 'FOG'] : ['FOG'];
            if (alphaPass) {
                defines.push("ALPHA_PASS");
            }
            const program = painter.getOrCreateProgram('globeAtmosphere', {defines: ((defines: any): DynamicDefinesType[])});

            const uniforms = atmosphereUniformValues(
                tr.frustumCorners.TL,
                tr.frustumCorners.TR,
                tr.frustumCorners.BR,
                tr.frustumCorners.BL,
                tr.frustumCorners.horizon,
                transitionT,
                horizonBlend,
                fogColor,
                highColor,
                spaceColor,
                temporalOffset,
                horizonAngle);

            painter.uploadCommonUniforms(context, program);

            const buffer = this.atmosphereBuffer;
            const colorMode = alphaPass ? this.colorModeWriteAlpha : this.colorModeAlphaBlendedWriteRGB;
            const name = alphaPass ? "atmosphere_glow_alpha" : "atmosphere_glow";
            if (buffer) {
                program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled,
                        colorMode, CullFaceMode.backCW, uniforms, name,
                        buffer.vertexBuffer, buffer.indexBuffer, buffer.segments);
            }
        };

        // Write atmosphere color
        draw(false);

        // Write atmosphere alpha - transparent areas need to be explicitly marked in a separate pass
        draw(true);
    }

    drawStars(painter: Painter, fog: Fog) {
        const starIntensity = clamp(fog.properties.get('star-intensity'), 0.0, 1.0);

        if (starIntensity === 0) {
            return;
        }

        const context = painter.context;
        const gl = context.gl;
        const tr = painter.transform;

        const program = painter.getOrCreateProgram('stars');

        // Exposed in internal style spec for mobile
        const sizeMultiplier = 0.15;

        const orientation = quat.identity([]);

        quat.rotateX(orientation, orientation, -tr._pitch);
        quat.rotateZ(orientation, orientation, -tr.angle);
        quat.rotateX(orientation, orientation, degToRad(tr._center.lat));
        quat.rotateY(orientation, orientation, -degToRad(tr._center.lng));

        const rotationMatrix = mat4.fromQuat(new Float32Array(16), orientation);

        const mvp = mat4.multiply([], tr.starsProjMatrix, rotationMatrix);

        const modelView3 = mat3.fromMat4([], rotationMatrix);

        const modelviewInv = mat3.invert([], modelView3);

        const camUp = [0, 1, 0];
        vec3.transformMat3(camUp, camUp, modelviewInv);
        vec3.scale(camUp, camUp, sizeMultiplier);
        const camRight = [1, 0, 0];
        vec3.transformMat3(camRight, camRight, modelviewInv);
        vec3.scale(camRight, camRight, sizeMultiplier);

        const uniforms = starsUniformValues(
              mvp,
              camUp,
              camRight,
              starIntensity);

        painter.uploadCommonUniforms(context, program);

        if (this.starsVx && this.starsIdx) {
            program.draw(painter, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled,
                this.colorModeAlphaBlendedWriteRGB, CullFaceMode.disabled, uniforms, "atmosphere_stars",
                this.starsVx, this.starsIdx, this.starsSegments);
        }
    }

}

export default Atmosphere;
