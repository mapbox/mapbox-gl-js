import Color from '../style-spec/util/color';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {default as ColorMode, ZERO, ONE, ONE_MINUS_SRC_ALPHA} from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    globeToMercatorTransition,
    globeUseCustomAntiAliasing
} from './../geo/projection/globe_util';
import {atmosphereUniformValues} from '../terrain/globe_raster_program';
import {AtmosphereBuffer} from '../render/atmosphere_buffer';
import {degToRad, mapValue, clamp} from '../util/util';
import {mat3, vec3, mat4, quat} from 'gl-matrix';
import SegmentVector from '../data/segment';
import {TriangleIndexArray, StarsVertexArray} from '../data/array_types';
import {starsLayout} from './stars_attributes';
import {starsUniformValues} from '../terrain/stars_program';
import {mulberry32} from '../style-spec/util/random';

import type Fog from '../style/fog';
import type Painter from './painter';
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';
import type {DynamicDefinesType} from './program/program_uniforms';

function generateUniformDistributedPointsOnSphere(pointsCount: number): Array<vec3> {
    const sRand = mulberry32(30);

    const points: Array<vec3> = [];
    for (let i = 0; i < pointsCount; ++i) {
        const lon = 2 * Math.PI * sRand();
        const lat = Math.acos(1 - 2 * sRand()) - Math.PI * 0.5;

        points.push(vec3.fromValues(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)));
    }

    return points;
}

class StarsParams {
    starsCount: number;
    sizeMultiplier: number;
    sizeRange: number;
    intensityRange: number;

    constructor() {
        this.starsCount = 16000;
        this.sizeMultiplier = 0.15;
        this.sizeRange = 100;
        this.intensityRange = 200;
    }
}
class Atmosphere {
    atmosphereBuffer: AtmosphereBuffer | null | undefined;
    starsVx: VertexBuffer | null | undefined;
    starsIdx: IndexBuffer | null | undefined;
    starsSegments: SegmentVector;
    colorModeAlphaBlendedWriteRGB: ColorMode;
    colorModeWriteAlpha: ColorMode;
    updateNeeded: boolean;

    params: StarsParams;

    constructor(painter: Painter) {
        this.colorModeAlphaBlendedWriteRGB = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, false]);
        this.colorModeWriteAlpha = new ColorMode([ONE, ZERO, ONE, ZERO], Color.transparent, [false, false, false, true]);

        this.params = new StarsParams();
        this.updateNeeded = true;

        painter.tp.registerParameter(this.params, ["Stars"], "starsCount", {min: 100, max: 16000, step: 1}, () => { this.updateNeeded = true; });
        painter.tp.registerParameter(this.params, ["Stars"], "sizeMultiplier", {min: 0.01, max: 2.0, step: 0.01});
        painter.tp.registerParameter(this.params, ["Stars"], "sizeRange", {min: 0.0, max: 200.0, step: 1}, () => { this.updateNeeded = true; });
        painter.tp.registerParameter(this.params, ["Stars"], "intensityRange", {min: 0.0, max: 200.0, step: 1}, () => { this.updateNeeded = true; });
    }

    update(painter: Painter) {
        const context = painter.context;

        if (!this.atmosphereBuffer || this.updateNeeded) {
            this.updateNeeded = false;

            this.atmosphereBuffer = new AtmosphereBuffer(context);

            // Part of internal style spec, not exposed to gl-js
            const sizeRange = this.params.sizeRange;
            const intensityRange = this.params.intensityRange;

            const stars = generateUniformDistributedPointsOnSphere(this.params.starsCount);
            const sRand = mulberry32(300);

            const vertices = new StarsVertexArray();
            const triangles = new TriangleIndexArray();

            let base = 0;
            for (let i = 0; i < stars.length; ++i) {

                const star = vec3.scale([] as unknown as vec3, stars[i], 200.0);

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

        const fogLUT = painter.style.getLut(fog.scope);
        const colorIgnoreLut = fog.properties.get('color-use-theme') === 'none';
        const fogColor = fog.properties.get('color').toNonPremultipliedRenderColor(colorIgnoreLut ? null : fogLUT).toArray01();

        const hignoreLutIgnoreLut = fog.properties.get('high-color-use-theme') === 'none';
        const highColor = fog.properties.get('high-color').toNonPremultipliedRenderColor(hignoreLutIgnoreLut ? null : fogLUT).toArray01();

        const spaceColorIgnoreLut = fog.properties.get('space-color-use-theme') === 'none';
        const spaceColor = fog.properties.get('space-color').toNonPremultipliedRenderColor(spaceColorIgnoreLut ? null : fogLUT).toArray01();

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
        const globeCenterInViewSpace = tr.globeCenterInViewSpace;
        const globeCenterDistance = vec3.length(globeCenterInViewSpace);
        const distanceToHorizon = Math.sqrt(Math.pow(globeCenterDistance, 2.0) - Math.pow(globeRadius, 2.0));
        const horizonAngle = Math.acos(distanceToHorizon / globeCenterDistance);

        const draw = (alphaPass: boolean) => {
            const defines = tr.projection.name === 'globe' ? ['PROJECTION_GLOBE_VIEW', 'FOG'] : ['FOG'];
            if (alphaPass) {
                defines.push("ALPHA_PASS");
            }
            const program = painter.getOrCreateProgram('globeAtmosphere', {defines: (defines as DynamicDefinesType[])});

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

        const orientation = quat.identity([] as unknown as quat);
        quat.rotateX(orientation, orientation, -tr._pitch);
        quat.rotateZ(orientation, orientation, -tr.angle);
        quat.rotateX(orientation, orientation, degToRad(tr._center.lat));
        quat.rotateY(orientation, orientation, -degToRad(tr._center.lng));

        const rotationMatrix = mat4.fromQuat(new Float32Array(16), orientation);
        const mvp = mat4.multiply([] as unknown as mat4, tr.starsProjMatrix, rotationMatrix);
        const modelView3 = mat3.fromMat4([] as unknown as mat3, rotationMatrix);
        const modelviewInv = mat3.invert([] as unknown as mat3, modelView3);

        const camUp: [number, number, number] = [0, 1, 0];
        vec3.transformMat3(camUp, camUp, modelviewInv);
        vec3.scale(camUp, camUp, this.params.sizeMultiplier);
        const camRight: [number, number, number] = [1, 0, 0];
        vec3.transformMat3(camRight, camRight, modelviewInv);
        vec3.scale(camRight, camRight, this.params.sizeMultiplier);

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
