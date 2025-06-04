// @flow
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {default as ColorMode} from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {vec3} from 'gl-matrix';
import SegmentVector from '../data/segment';
import {TriangleIndexArray, SnowVertexArray} from '../data/array_types';
import {snowUniformValues} from './snow_program';
import {mulberry32} from '../style-spec/util/random';
import {snowLayout} from "./snow_attributes";
import {PrecipitationRevealParams} from './precipitation_reveal_params';
import {createTpBindings} from './vignette';
import {boxWrap, generateUniformDistributedPointsInsideCube, lerpClamp, PrecipitationBase} from './common';
import {Debug} from '../util/debug';

import type {vec2, vec4} from 'gl-matrix';
import type Painter from '../render/painter';
import type {VignetteParams} from './vignette';

type SnowParams = {
    overrideStyleParameters: boolean;
    intensity: number;
    timeFactor: number;
    velocityConeAperture: number;
    velocity: number;
    horizontalOscillationRadius: number;
    horizontalOscillationRate: number;
    boxSize: number;
    billboardSize: number;
    shapeFadeStart: number;
    shapeFadePower: number;
    screenThinning:{
        intensity: number;
        start: number;
        range: number;
        fadePower: number;
        affectedRatio: number;
        particleOffset: number;
    },
    color: {r: number; g: number; b: number; a: number};
    direction: {x: number; y: number},
};

export class Snow extends PrecipitationBase {
    _revealParams: PrecipitationRevealParams;

    _params: SnowParams;

    _vignetteParams: VignetteParams;

    constructor(painter: Painter) {
        super(2.25);

        this._params = {
            overrideStyleParameters: false,
            intensity: 0.85,
            timeFactor: 0.75,
            velocityConeAperture: 70.0,
            velocity: 40.0,
            horizontalOscillationRadius: 4.0,
            horizontalOscillationRate: 1.5,
            boxSize: 2000,
            billboardSize: 2.0,
            shapeFadeStart: 0.27,
            shapeFadePower: 0.21,
            screenThinning: {
                intensity: 0.4,
                start: 0.15,
                range: 1.4,
                fadePower: 0.24,
                affectedRatio: 1.0,
                particleOffset: -0.2
            },
            color: {r: 1.0, g: 1, b: 1, a: 1.0},
            direction: {x: -50, y: -35},
        };

        const tp = painter.tp;
        const scope = ["Precipitation", "Snow"];
        this._revealParams = new PrecipitationRevealParams(painter.tp, scope);
        this._vignetteParams = {
            strength: 0.3,
            start: 0.78,
            range: 0.46,
            fadePower: 0.2,
            color: {r: 1, g: 1, b: 1, a: 1}
        };
        this.particlesCount = 16000;

        Debug.run(() => {
            tp.registerParameter(this._params, scope, 'overrideStyleParameters');
            tp.registerParameter(this._params, scope, 'intensity', {min: 0.0, max: 1.0});
            tp.registerParameter(this._params, scope, 'timeFactor', {min: 0.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params, scope, 'velocityConeAperture', {min: 0.0, max: 160.0, step: 1.0});
            tp.registerParameter(this._params, scope, 'velocity', {min: 0.0, max: 500.0, step: 0.5});
            tp.registerParameter(this._params, scope, 'horizontalOscillationRadius', {min: 0.0, max: 10.0, step: 0.1});
            tp.registerParameter(this._params, scope, 'horizontalOscillationRate', {min: 0.3, max: 3.0, step: 0.05});
            tp.registerParameter(this._params, scope, 'boxSize', {min: 100.0, max: 10000.0, step: 50.0});
            tp.registerParameter(this._params, scope, 'billboardSize', {min: 0.1, max: 10.0, step: 0.01});

            const thinningScope = [...scope, "ScreenThinning"];

            tp.registerParameter(this._params.screenThinning, thinningScope, 'intensity', {min: 0.0, max: 1.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'start', {min: 0.0, max: 2.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'range', {min: 0.0, max: 2.0});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'fadePower', {min: -1.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'affectedRatio', {min: 0.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params.screenThinning, thinningScope, 'particleOffset', {min: -1.0, max: 1.0, step: 0.01});

            const shapeScope = [...scope, "Shape"];
            tp.registerParameter(this._params, shapeScope, 'shapeFadeStart', {min: 0.0, max: 1.0, step: 0.01});
            tp.registerParameter(this._params, shapeScope, 'shapeFadePower', {min: -1.0, max: 0.99, step: 0.01});

            tp.registerParameter(this._params, scope, 'color', {
                color: {type: 'float'},
            });

            const vignetteScope = [...scope, "Vignette"];
            createTpBindings(this._vignetteParams, painter, vignetteScope);

            tp.registerParameter(this._params, scope, 'direction', {
                picker: 'inline',
                expanded: true,
                x: {min: -200, max: 200},
                y: {min: -200, max: 200},
            });
        });
    }

    update(painter: Painter) {
        const context = painter.context;

        if (!this.particlesVx) {
            const positions = generateUniformDistributedPointsInsideCube(this.particlesCount);

            const vertices = new SnowVertexArray();
            const triangles = new TriangleIndexArray();

            let base = 0;
            const sRand = mulberry32(1323123451230);
            for (let i = 0; i < positions.length; ++i) {
                const p = positions[i];

                const velocityScale = sRand();
                const directionConeHeading = sRand();
                const directionConePitch = sRand();
                const data: vec4 = [i / positions.length, velocityScale, directionConeHeading, directionConePitch];
                const dataHorizontalOscillation: vec2 = [sRand(), sRand()];

                vertices.emplaceBack(p[0], p[1], p[2], -1, -1, ...data, ...dataHorizontalOscillation);
                vertices.emplaceBack(p[0], p[1], p[2], 1, -1, ...data, ...dataHorizontalOscillation);
                vertices.emplaceBack(p[0], p[1], p[2], 1, 1, ...data, ...dataHorizontalOscillation);
                vertices.emplaceBack(p[0], p[1], p[2], -1, 1, ...data, ...dataHorizontalOscillation);

                triangles.emplaceBack(base + 0, base + 1, base + 2);
                triangles.emplaceBack(base + 0, base + 2, base + 3);

                base += 4;
            }

            this.particlesVx = context.createVertexBuffer(vertices, snowLayout.members);
            this.particlesIdx = context.createIndexBuffer(triangles);
        }
    }

    draw(painter: Painter) {
        if (!this._params.overrideStyleParameters && !painter.style.snow) {
            return;
        }

        const params = structuredClone(this._params);

        let snowDirection: vec3 = [-params.direction.x, params.direction.y, -100];
        vec3.normalize(snowDirection, snowDirection);

        const vignetteParams = structuredClone(this._vignetteParams);

        // Global parameters
        const gp = params.overrideStyleParameters ? this._revealParams : {revealStart: 0, revealRange: 0.01};

        const zoom = painter.transform.zoom;
        if (gp.revealStart > zoom) { return; }
        const revealFactor = lerpClamp(0, 1, gp.revealStart, gp.revealStart + gp.revealRange, zoom);

        vignetteParams.strength *= revealFactor;

        // Use values from stylespec if not overriden
        if (!params.overrideStyleParameters) {
            params.intensity = painter.style.snow.state.density;
            params.timeFactor = painter.style.snow.state.intensity;
            params.color = structuredClone(painter.style.snow.state.color);
            snowDirection = structuredClone(painter.style.snow.state.direction);
            params.screenThinning.intensity = painter.style.snow.state.centerThinning;

            params.billboardSize = 2.79 * painter.style.snow.state.flakeSize;

            vignetteParams.strength = 1;
            vignetteParams.color = structuredClone(painter.style.snow.state.vignetteColor);
        }

        const drawData = this.updateOnRender(painter, params.timeFactor);

        if (!this.particlesVx || !this.particlesIdx) {
            return;
        }

        const context = painter.context;
        const gl = context.gl;
        const tr = painter.transform;

        const program = painter.getOrCreateProgram('snowParticle');

        painter.uploadCommonUniforms(context, program);

        const drawParticlesBox = (boxSize: number, sizeScale: number, dp: SnowParams) => {
            const camPos = boxWrap(this._movement.getPosition(), boxSize);

            const thinningX = tr.width  / 2;
            const thinningY = tr.height  / 2;

            const thinningStart = lerpClamp(0, dp.screenThinning.start, 0, 1, dp.screenThinning.intensity);
            const thinningRange = lerpClamp(0.001, dp.screenThinning.range, 0, 1, dp.screenThinning.intensity);
            const thinningParticleOffset = lerpClamp(0.0, dp.screenThinning.particleOffset, 0, 1, dp.screenThinning.intensity);

            const uniforms = snowUniformValues({
                modelview: drawData.modelviewMatrix,
                projection: drawData.projectionMatrix,
                time: this._accumulatedTimeFromStart,
                camPos: camPos as [number, number, number],
                velocityConeAperture: dp.velocityConeAperture,
                velocity: dp.velocity,
                horizontalOscillationRadius: dp.horizontalOscillationRadius,
                horizontalOscillationRate: dp.horizontalOscillationRate,
                boxSize,
                billboardSize: dp.billboardSize * sizeScale,
                simpleShapeParameters: [dp.shapeFadeStart, dp.shapeFadePower],
                screenSize: [tr.width, tr.height],
                thinningCenterPos: [thinningX, thinningY],
                thinningShape: [thinningStart, thinningRange, Math.pow(10.0, dp.screenThinning.fadePower)],
                thinningAffectedRatio: dp.screenThinning.affectedRatio,
                thinningParticleOffset,
                color: [dp.color.r, dp.color.g, dp.color.b, dp.color.a],
                direction: snowDirection as [number, number, number]
            }
            );

            const count = Math.round(dp.intensity * this.particlesCount);
            const particlesSegments = SegmentVector.simpleSegment(0, 0, count * 4, count * 2);

            if (this.particlesVx && this.particlesIdx) {
                program.draw(painter, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled,
                ColorMode.alphaBlended, CullFaceMode.disabled, uniforms, "snow_particles",
                this.particlesVx, this.particlesIdx, particlesSegments);
            }
        };

        drawParticlesBox(params.boxSize, 1.0, params);

        this._vignette.draw(painter, vignetteParams);
    }
}
