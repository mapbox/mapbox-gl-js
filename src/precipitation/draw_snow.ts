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
import {boxWrap, generateUniformDistributedPointsInsideCube, lerpClamp, PrecipitationBase} from './common';
import {createDefaultRevealParams} from './precipitation_reveal_params';
import {Debug} from '../util/debug';

import type {DevToolsFolder} from '../ui/control/devtools';
import type {PrecipitationRevealParams} from './precipitation_reveal_params';
import type Painter from '../render/painter';
import type {VignetteParams} from './vignette';

type SnowDrawParams = {
    params: SnowParams;
    vignetteParams: VignetteParams;
    revealParams: PrecipitationRevealParams;
    direction: vec3;
};

export type SnowParams = {
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

export function createDefaultSnowParams(): SnowParams {
    return {
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
}

export function createDefaultSnowVignetteParams(): VignetteParams {
    return {
        strength: 0.3,
        start: 0.78,
        range: 0.46,
        fadePower: 0.2,
        color: {r: 1, g: 1, b: 1, a: 1}
    };
}

export class Snow extends PrecipitationBase {
    _params: SnowParams;

    _vignetteParams: VignetteParams;

    _devtoolsFolder: DevToolsFolder | null;

    _painter: Painter | null;

    constructor() {
        super(2.25);
        this._params = createDefaultSnowParams();
        this._vignetteParams = createDefaultSnowVignetteParams();
        this.particlesCount = 16000;
        this._devtoolsFolder = null;
        this._painter = null;
    }

    override destroy() {
        Debug.run(() => {
            if (this._painter && this._painter._devtools) {
                this._painter._devtools.removeFolder('Snow');
            }
            this._devtoolsFolder = null;
        });
        super.destroy();
    }

    update(painter: Painter) {
        Debug.run(() => {
            this._painter = painter;

            if (painter._devtools && !this._devtoolsFolder) {
                const precipFolder = painter._devtools.addFolder('Precipitation');

                // Register shared binding only if we're the first to create the folder
                if (precipFolder.folder.children.length === 0) {
                    precipFolder.addBinding(painter._debugParams, 'forceEnablePrecipitation', {}, () => painter.style.map.triggerRepaint());
                }

                precipFolder.addBinding(painter._debugParams, 'overrideSnowParams', {}, () => {
                    painter.style.map.triggerRepaint();
                    snowFolder.folder.expanded = painter._debugParams.overrideSnowParams;
                    snowFolder.folder.disabled = !painter._debugParams.overrideSnowParams;
                });

                const snowParams = createDefaultSnowParams();
                const snowRevealParams = createDefaultRevealParams();
                const snowVignetteParams = createDefaultSnowVignetteParams();
                painter._debugParams.snowParamsOverride = snowParams;
                painter._debugParams.snowRevealParamsOverride = snowRevealParams;
                painter._debugParams.snowVignetteParamsOverride = snowVignetteParams;

                const snowFolder = precipFolder.addSubFolder('Snow', {expanded: false, disabled: !painter._debugParams.overrideSnowParams});

                snowFolder.addBinding(snowParams, 'color', {color: {type: 'float'}}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'direction', {picker: 'inline', expanded: true, x: {min: -200, max: 200}, y: {min: -200, max: 200}}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'intensity', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'timeFactor', {min: 0.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'velocityConeAperture', {min: 0.0, max: 160.0, step: 1.0}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'velocity', {min: 0.0, max: 500.0, step: 0.5}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'horizontalOscillationRadius', {min: 0.0, max: 10.0, step: 0.1}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'horizontalOscillationRate', {min: 0.3, max: 3.0, step: 0.05}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'boxSize', {min: 100.0, max: 10000.0, step: 50.0}, () => painter.style.map.triggerRepaint());
                snowFolder.addBinding(snowParams, 'billboardSize', {min: 0.1, max: 10.0, step: 0.01}, () => painter.style.map.triggerRepaint());

                const snowRevealFolder = snowFolder.addSubFolder('Snow_Reveal', {title: 'Reveal'});
                snowRevealFolder.addBinding(snowRevealParams, 'revealStart', {min: 0, max: 17, step: 0.05}, () => painter.style.map.triggerRepaint());
                snowRevealFolder.addBinding(snowRevealParams, 'revealRange', {min: 0.1, max: 5.1, step: 0.05}, () => painter.style.map.triggerRepaint());

                const snowScreenThinningFolder = snowFolder.addSubFolder('Snow_ScreenThinning', {title: 'Screen Thinning'});
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'intensity', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'start', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'range', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'fadePower', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'affectedRatio', {min: 0.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                snowScreenThinningFolder.addBinding(snowParams.screenThinning, 'particleOffset', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());

                const snowShapeFolder = snowFolder.addSubFolder('Snow_Shape', {title: 'Shape'});
                snowShapeFolder.addBinding(snowParams, 'shapeFadeStart', {min: 0.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                snowShapeFolder.addBinding(snowParams, 'shapeFadePower', {min: -1.0, max: 0.99, step: 0.01}, () => painter.style.map.triggerRepaint());

                const snowVignetteFolder = snowFolder.addSubFolder('Snow_Vignette', {title: 'Vignette'});
                snowVignetteFolder.addBinding(snowVignetteParams, 'start', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                snowVignetteFolder.addBinding(snowVignetteParams, 'range', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                snowVignetteFolder.addBinding(snowVignetteParams, 'fadePower', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                snowVignetteFolder.addBinding(snowVignetteParams, 'strength', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                snowVignetteFolder.addBinding(snowVignetteParams, 'color', {color: {type: 'float'}}, () => painter.style.map.triggerRepaint());

                this._devtoolsFolder = precipFolder;
            }
        });

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
                const data: [number, number, number, number] = [i / positions.length, velocityScale, directionConeHeading, directionConePitch];
                const dataHorizontalOscillation: [number, number] = [sRand(), sRand()];

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

    getDrawParams(painter: Painter): SnowDrawParams | null {
        // In debug builds, Debug.run() populates debugParams from devtools overrides.
        // In production, Debug.run() is stripped and we always fall through to the style-spec path.
        let debugParams: SnowDrawParams | null = null;

        Debug.run(() => {
            if (!painter._debugParams.overrideSnowParams || !painter._debugParams.snowParamsOverride) {
                return;
            }

            const params = structuredClone(painter._debugParams.snowParamsOverride);
            const direction: vec3 = [-params.direction.x, params.direction.y, -100];
            vec3.normalize(direction, direction);

            const vp = painter._debugParams.snowVignetteParamsOverride ?
                structuredClone(painter._debugParams.snowVignetteParamsOverride) :
                structuredClone(this._vignetteParams);

            const rp = painter._debugParams.snowRevealParamsOverride ?
                Object.assign({}, painter._debugParams.snowRevealParamsOverride) :
                {revealStart: 0, revealRange: 0.01};

            debugParams = {
                params,
                vignetteParams: vp,
                revealParams: rp,
                direction
            };
        });

        if (debugParams) return debugParams;

        if (!painter.style.snow) return null;

        const state = painter.style.snow.state;
        const params = structuredClone(this._params);
        params.intensity = state.density;
        params.timeFactor = state.intensity;
        params.color = structuredClone(state.color);
        params.screenThinning.intensity = state.centerThinning;
        params.billboardSize = 2.79 * state.flakeSize;

        const vignetteParams = structuredClone(this._vignetteParams);
        vignetteParams.strength = 1;
        vignetteParams.color = structuredClone(state.vignetteColor);

        return {
            params,
            vignetteParams,
            revealParams: {revealStart: 0, revealRange: 0.01},
            direction: structuredClone(state.direction)
        };
    }

    draw(painter: Painter) {
        const drawParams = this.getDrawParams(painter);
        if (!drawParams) return;

        const {params, revealParams, direction, vignetteParams} = drawParams;

        // Check reveal factor
        const zoom = painter.transform.zoom;
        if (revealParams.revealStart > zoom) return;
        const revealFactor = lerpClamp(0, 1, revealParams.revealStart, revealParams.revealStart + revealParams.revealRange, zoom);

        vignetteParams.strength *= revealFactor;

        // Update timing
        const drawData = this.updateOnRender(painter, params.timeFactor);

        // Verify buffers exist
        if (!this.particlesVx || !this.particlesIdx) return;

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
                direction: direction as [number, number, number]
            });

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
