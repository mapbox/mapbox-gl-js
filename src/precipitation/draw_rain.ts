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
import {PrecipitationBase, boxWrap, generateUniformDistributedPointsInsideCube, lerpClamp} from './common';
import {createDefaultRevealParams} from './precipitation_reveal_params.js';
import {Debug} from '../util/debug';

import type {DevToolsFolder} from '../ui/control/devtools';
import type {PrecipitationRevealParams} from './precipitation_reveal_params.js';
import type Painter from '../render/painter';
import type {VignetteParams} from './vignette';

type RainDrawParams = {
    params: RainParams;
    vignetteParams: VignetteParams;
    revealParams: PrecipitationRevealParams;
    direction: vec3;
};

export type RainParams = {
    intensity: number;
    timeFactor: number;
    velocityConeAperture: number;
    velocity: number;
    boxSize: number;
    dropletSizeX: number;
    dropletSizeYScale: number;
    distortionStrength: number;
    screenThinning: {
        intensity: number;
        start: number;
        range: number;
        fadePower: number;
        affectedRatio: number;
        particleOffset: number;
    };
    color: {r: number; g: number; b: number; a: number};
    direction: {x: number; y: number};
    shapeDirPower: number;
    shapeNormalPower: number;
};

export function createDefaultRainParams(): RainParams {
    return {
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
}

export function createDefaultRainVignetteParams(): VignetteParams {
    return {
        strength: 1.0,
        start: 0.7,
        range: 1.0,
        fadePower: 0.4,
        color: {r: 0.27, g: 0.27, b: 0.27, a: 1}
    };
}

export class Rain extends PrecipitationBase {
    screenTexture: Texture | null | undefined;

    _params: RainParams;

    _vignetteParams: VignetteParams;

    _devtoolsFolder: DevToolsFolder | null;

    _painter: Painter | null;

    constructor() {
        super(4.25);
        this._params = createDefaultRainParams();
        this._vignetteParams = createDefaultRainVignetteParams();
        this.particlesCount = 16000;
        this._devtoolsFolder = null;
        this._painter = null;
    }

    override destroy() {
        Debug.run(() => {
            if (this._painter && this._painter._devtools) {
                this._painter._devtools.removeFolder('Rain');
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

                precipFolder.addBinding(painter._debugParams, 'overrideRainParams', {}, () => {
                    painter.style.map.triggerRepaint();
                    rainFolder.folder.expanded = painter._debugParams.overrideRainParams;
                    rainFolder.folder.disabled = !painter._debugParams.overrideRainParams;
                });

                const rainParams = createDefaultRainParams();
                const rainRevealParams = createDefaultRevealParams();
                const rainVignetteParams = createDefaultRainVignetteParams();
                painter._debugParams.rainParamsOverride = rainParams;
                painter._debugParams.rainRevealParamsOverride = rainRevealParams;
                painter._debugParams.rainVignetteParamsOverride = rainVignetteParams;

                const rainFolder = precipFolder.addSubFolder('Rain', {expanded: false, disabled: !painter._debugParams.overrideRainParams});

                rainFolder.addBinding(rainParams, 'color', {color: {type: 'float'}}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'direction', {picker: 'inline', expanded: true, x: {min: -200, max: 200}, y: {min: -200, max: 200}}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'intensity', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'timeFactor', {min: 0.0, max: 3.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'velocityConeAperture', {min: 0.0, max: 160.0, step: 1.0}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'velocity', {min: 0.0, max: 1500.0, step: 5}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'boxSize', {min: 100.0, max: 4400.0, step: 10.0}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'dropletSizeX', {min: 0.1, max: 10.0, step: 0.1}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'dropletSizeYScale', {min: 0.1, max: 10.0, step: 0.1}, () => painter.style.map.triggerRepaint());
                rainFolder.addBinding(rainParams, 'distortionStrength', {min: 0.0, max: 100.0, step: 0.5}, () => painter.style.map.triggerRepaint());

                const rainRevealFolder = rainFolder.addSubFolder('Rain_Reveal', {title: 'Reveal'});
                rainRevealFolder.addBinding(rainRevealParams, 'revealStart', {min: 0, max: 17, step: 0.05}, () => painter.style.map.triggerRepaint());
                rainRevealFolder.addBinding(rainRevealParams, 'revealRange', {min: 0.1, max: 5.1, step: 0.05}, () => painter.style.map.triggerRepaint());

                const rainScreenThinningFolder = rainFolder.addSubFolder('Rain_ScreenThinning', {title: 'Screen Thinning'});
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'intensity', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'start', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'range', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'fadePower', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'affectedRatio', {min: 0.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                rainScreenThinningFolder.addBinding(rainParams.screenThinning, 'particleOffset', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());

                const rainShapeFolder = rainFolder.addSubFolder('Rain_Shape', {title: 'Shape'});
                rainShapeFolder.addBinding(rainParams, 'shapeDirPower', {min: 1.0, max: 10.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                rainShapeFolder.addBinding(rainParams, 'shapeNormalPower', {min: 1.0, max: 10.0, step: 0.01}, () => painter.style.map.triggerRepaint());

                const rainVignetteFolder = rainFolder.addSubFolder('Rain_Vignette', {title: 'Vignette'});
                rainVignetteFolder.addBinding(rainVignetteParams, 'start', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                rainVignetteFolder.addBinding(rainVignetteParams, 'range', {min: 0.0, max: 2.0}, () => painter.style.map.triggerRepaint());
                rainVignetteFolder.addBinding(rainVignetteParams, 'fadePower', {min: -1.0, max: 1.0, step: 0.01}, () => painter.style.map.triggerRepaint());
                rainVignetteFolder.addBinding(rainVignetteParams, 'strength', {min: 0.0, max: 1.0}, () => painter.style.map.triggerRepaint());
                rainVignetteFolder.addBinding(rainVignetteParams, 'color', {color: {type: 'float'}}, () => painter.style.map.triggerRepaint());

                this._devtoolsFolder = precipFolder;
            }
        });

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
                const data: [number, number, number, number] = [angularVelocityScale, velocityScale, directionConeHeading, directionConePitch];

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

    getDrawParams(painter: Painter): RainDrawParams | null {
        // In debug builds, Debug.run() populates debugParams from devtools overrides.
        // In production, Debug.run() is stripped and we always fall through to the style-spec path.
        let debugParams: RainDrawParams | null = null;
        Debug.run(() => {
            if (!painter._debugParams.overrideRainParams || !painter._debugParams.rainParamsOverride) {
                return;
            }

            const params = structuredClone(painter._debugParams.rainParamsOverride);
            const direction: vec3 = [-params.direction.x, params.direction.y, -100];
            vec3.normalize(direction, direction);

            const vp = painter._debugParams.rainVignetteParamsOverride ?
                structuredClone(painter._debugParams.rainVignetteParamsOverride) :
                structuredClone(this._vignetteParams);
            const rp = painter._debugParams.rainRevealParamsOverride ?
                Object.assign({}, painter._debugParams.rainRevealParamsOverride) :
                {revealStart: 0, revealRange: 0.01};

            debugParams = {
                params,
                vignetteParams: vp,
                revealParams: rp,
                direction
            };
        });

        if (debugParams) return debugParams;

        if (!painter.style.rain) return null;

        const state = painter.style.rain.state;
        const params = structuredClone(this._params);
        params.intensity = state.density;
        params.timeFactor = state.intensity;
        params.color = structuredClone(state.color);
        params.screenThinning.intensity = state.centerThinning;
        params.dropletSizeX = state.dropletSize[0];
        params.dropletSizeYScale = state.dropletSize[1] / state.dropletSize[0];
        params.distortionStrength = state.distortionStrength * 100;

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

        // Verify buffers exist
        if (!this.particlesVx || !this.particlesIdx) return;

        vignetteParams.strength *= revealFactor;

        // Update timing
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

        const colorVec: [number, number, number, number] = [params.color.r, params.color.g, params.color.b, params.color.a];

        const drawParticlesBox = (boxSize: number, distortionOnly: boolean) => {
            const camPos = boxWrap(this._movement.getPosition(), boxSize);

            const sizeX = params.dropletSizeX;
            const sizeY = params.dropletSizeX * params.dropletSizeYScale;

            const thinningX = painter.width / 2;
            const thinningY = painter.height / 2;

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
                rainDirection: direction as [number, number, number],
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
