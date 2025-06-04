// // @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import {default as ColorMode} from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {vec3} from 'gl-matrix';
import SegmentVector from '../data/segment.js';
import {TriangleIndexArray, RainVertexArray} from '../data/array_types.js';
import {rainUniformValues} from './rain_program.js';
import {mulberry32} from '../style-spec/util/random.js';
import {rainLayout} from "./rain_attributes.js";
import Texture from '../render/texture.js';
import {PrecipitationRevealParams} from './precipitation_reveal_params.js';
import {createTpBindings} from './vignette';
import {PrecipitationBase, boxWrap, generateUniformDistributedPointsInsideCube, lerpClamp} from './common';
import {Debug} from '../util/debug';

import type {vec4} from 'gl-matrix';
import type Painter from '../render/painter';
import type {VignetteParams} from './vignette';

export class Rain extends PrecipitationBase {
    screenTexture: Texture | null | undefined;

    _revealParams: PrecipitationRevealParams;

    _params: {
        overrideStyleParameters: boolean,
        intensity: number,
        timeFactor: number,
        velocityConeAperture: number,
        velocity: number,
        boxSize: number,
        dropletSizeX: number,
        dropletSizeYScale: number,
        distortionStrength: number,
        screenThinning:{
            intensity: number,
            start: number,
            range: number,
            fadePower: number,
            affectedRatio: number,
            particleOffset: number
        },
        color: { r: number, g: number, b: number, a: number },
        direction: {x: number, y: number},
        shapeDirPower: number;
        shapeNormalPower: number;
    };

    _vignetteParams: VignetteParams;

    constructor(painter: Painter) {
        super(4.25);

        this._params = {
            overrideStyleParameters: false,
            intensity: 0.5,
            timeFactor: 1.0,
            velocityConeAperture: 0.0,
            velocity: 300.0,
            boxSize: 2500,
            dropletSizeX: 1.0,
            dropletSizeYScale: 10.0,
            distortionStrength: 70.0,
            screenThinning: {
                intensity: 0.57,
                start: 0.46,
                range: 1.17,
                fadePower: 0.17,
                affectedRatio: 1.0,
                particleOffset: -0.2
            },
            color: {r: 0.66, g: 0.68, b: 0.74, a: 0.7},
            direction: {x: -50, y: -35},
            shapeDirPower: 2.0,
            shapeNormalPower: 1.0
        };

        const tp = painter.tp;

        const scope = ["Precipitation", "Rain"];
        this._revealParams = new PrecipitationRevealParams(painter.tp, scope);

        this._vignetteParams = {
            strength: 1.0,
            start: 0.7,
            range: 1.0,
            fadePower: 0.4,
            color: {r: 0.27, g: 0.27, b: 0.27, a: 1}
        };

        this.particlesCount = 16000;

        Debug.run(() => {

            tp.registerParameter(this._params, scope, 'overrideStyleParameters');
            tp.registerParameter(this._params, scope, 'intensity', {min: 0.0, max: 1.0});
            tp.registerParameter(this._params, scope, 'timeFactor', {min: 0.0, max: 3.0, step: 0.01});
            tp.registerParameter(this._params, scope, 'velocityConeAperture', {min: 0.0, max: 160.0, step: 1.0});
            tp.registerParameter(this._params, scope, 'velocity', {min: 0.0, max: 1500.0, step: 5});
            tp.registerParameter(this._params, scope, 'boxSize', {min: 100.0, max: 4400.0, step: 10.0});
            tp.registerParameter(this._params, scope, 'dropletSizeX', {min: 0.1, max: 10.0, step: 0.1});
            tp.registerParameter(this._params, scope, 'dropletSizeYScale', {min: 0.1, max: 10.0, step: 0.1});
            tp.registerParameter(this._params, scope, 'distortionStrength', {min: 0.0, max: 100.0, step: 0.5});

            tp.registerParameter(this._params, scope, 'direction', {
                picker: 'inline',
                expanded: true,
                x: {min: -200, max: 200},
                y: {min: -200, max: 200},
            });

            const shapeScope = [...scope, "Shape"];
            tp.registerParameter(this._params, shapeScope, 'shapeDirPower', {min: 1.0, max: 10.0, step: 0.01});
            tp.registerParameter(this._params, shapeScope, 'shapeNormalPower', {min: 1.0, max: 10.0, step: 0.01});

            tp.registerParameter(this._params, scope, 'color', {
                color: {type: 'float'},
            });

            const thinningScope = [...scope, "ScreenThinning"];

            tp.registerParameter(this._params.screenThinning, thinningScope, 'intensity', {min: 0.0, max: 1.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'start', {min: 0.0, max: 2.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'range', {min: 0.0, max: 2.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'fadePower', {min: -1.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'affectedRatio', {min: 0.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'particleOffset', {min: -1.0, max: 1.0, step: 0.01});

            const vignetteScope = [...scope, "Vignette"];
            createTpBindings(this._vignetteParams, painter, vignetteScope);
        });
    }

    update(painter: Painter) {
        const context = painter.context;

        if (!this.particlesVx) {

            const positions = generateUniformDistributedPointsInsideCube(this.particlesCount);

            const vertices = new RainVertexArray();
            const triangles = new TriangleIndexArray();

            let base = 0;
            const sRand = mulberry32(1323123451230);
            for (let i = 0; i < positions.length; ++i) {

                const p = positions[i];

                const angularVelocityScale = -1 + 2 * sRand();
                const velocityScale = sRand();
                const directionConeHeading = sRand();
                const directionConePitch = sRand();
                const data: vec4 = [angularVelocityScale, velocityScale, directionConeHeading, directionConePitch];

                vertices.emplaceBack(p[0], p[1], p[2], -1, -1, ...data);
                vertices.emplaceBack(p[0], p[1], p[2], 1, -1, ...data);
                vertices.emplaceBack(p[0], p[1], p[2], 1, 1, ...data);
                vertices.emplaceBack(p[0], p[1], p[2], -1, 1, ...data);

                triangles.emplaceBack(base + 0, base + 1, base + 2);
                triangles.emplaceBack(base + 0, base + 2, base + 3);

                base += 4;
            }

            this.particlesVx = context.createVertexBuffer(vertices, rainLayout.members);
            this.particlesIdx = context.createIndexBuffer(triangles);
        }
    }

    draw(painter: Painter) {
        if (!this._params.overrideStyleParameters && !painter.style.rain) {
            return;
        }

        // Global parameters
        const gp = this._params.overrideStyleParameters ? this._revealParams : {revealStart: 0, revealRange: 0.01};
        const zoom = painter.transform.zoom;
        if (gp.revealStart > zoom) { return; }
        const revealFactor = lerpClamp(0, 1, gp.revealStart, gp.revealStart + gp.revealRange, zoom);

        if (!this.particlesVx || !this.particlesIdx) {
            return;
        }

        const params = structuredClone(this._params);

        let rainDirection: vec3 = [-params.direction.x, params.direction.y, -100];
        vec3.normalize(rainDirection, rainDirection);

        const vignetteParams = structuredClone(this._vignetteParams);

        vignetteParams.strength *= revealFactor;

        // Use values from stylespec if not overriden
        if (!params.overrideStyleParameters) {
            params.intensity = painter.style.rain.state.density;
            params.timeFactor = painter.style.rain.state.intensity;
            params.color = structuredClone(painter.style.rain.state.color);
            rainDirection = structuredClone(painter.style.rain.state.direction);
            params.screenThinning.intensity = painter.style.rain.state.centerThinning;
            params.dropletSizeX = painter.style.rain.state.dropletSize[0];
            params.dropletSizeYScale = painter.style.rain.state.dropletSize[1] / painter.style.rain.state.dropletSize[0];
            params.distortionStrength = painter.style.rain.state.distortionStrength * 100;

            vignetteParams.strength = 1;
            vignetteParams.color = structuredClone(painter.style.rain.state.vignetteColor);
        }

        const drawData = this.updateOnRender(painter, params.timeFactor);

        const context = painter.context;
        const gl = context.gl;

        //
        // Fill screen texture
        //

        const tr = painter.transform;

        if (!this.screenTexture || this.screenTexture.size[0] !== painter.width || this.screenTexture.size[1] !== painter.height) {
            this.screenTexture = new Texture(context, {width: painter.width, height: painter.height, data: null}, gl.RGBA8);
        }

        if (params.distortionStrength > 0) {
            context.activeTexture.set(gl.TEXTURE0);
            this.screenTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, painter.width, painter.height);
        }

        const program = painter.getOrCreateProgram('rainParticle');

        painter.uploadCommonUniforms(context, program);

        context.activeTexture.set(gl.TEXTURE0);
        this.screenTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        const colorVec: vec4 = [params.color.r, params.color.g, params.color.b, params.color.a];

        const drawParticlesBox = (boxSize: number, distortionOnly: boolean) => {
            const camPos = boxWrap(this._movement.getPosition(), boxSize);

            const sizeX = params.dropletSizeX;
            const sizeY = params.dropletSizeX * params.dropletSizeYScale;

            const thinningX = painter.width  / 2;
            const thinningY = painter.height  / 2;

            const thinningStart = lerpClamp(0, params.screenThinning.start, 0, 1, params.screenThinning.intensity);
            const thinningRange = lerpClamp(0.001, params.screenThinning.range, 0, 1, params.screenThinning.intensity);
            const thinningParticleOffset = lerpClamp(0.0, params.screenThinning.particleOffset, 0, 1, params.screenThinning.intensity);

            const uniforms = rainUniformValues({
                modelview: drawData.modelviewMatrix,
                projection: drawData.projectionMatrix,
                time: this._accumulatedTimeFromStart,
                camPos: camPos as [number, number, number],
                velocityConeAperture: params.velocityConeAperture,
                velocity: params.velocity,
                boxSize,
                rainDropletSize: [sizeX, sizeY],
                distortionStrength: params.distortionStrength,
                rainDirection: rainDirection as [number, number, number],
                color: colorVec,
                screenSize: [tr.width, tr.height],
                thinningCenterPos: [thinningX, thinningY],
                thinningShape: [thinningStart, thinningRange, Math.pow(10.0, params.screenThinning.fadePower)],
                thinningAffectedRatio: params.screenThinning.affectedRatio,
                thinningParticleOffset,
                shapeDirectionalPower: params.shapeDirPower,
                shapeNormalPower: params.shapeNormalPower,
                mode: distortionOnly ? 0 : 1
            });

            const count = Math.round(params.intensity * this.particlesCount);
            const particlesSegments = SegmentVector.simpleSegment(0, 0, count * 4, count * 2);

            program.draw(painter, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled,
                ColorMode.alphaBlended, CullFaceMode.disabled, uniforms, "rain_particles",
                this.particlesVx, this.particlesIdx, particlesSegments);
        };

        // Distortion only
        if (params.distortionStrength > 0) {
            drawParticlesBox(params.boxSize, true);
        }

        // Same data alpha blended only
        drawParticlesBox(params.boxSize, false);

        this._vignette.draw(painter, vignetteParams);
    }

}
