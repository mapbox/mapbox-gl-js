// // @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import {default as ColorMode} from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {degToRad, clamp} from '../util/util.js';
import {vec3, mat4, quat} from 'gl-matrix';
import SegmentVector from '../data/segment.js';
import {TriangleIndexArray, RainVertexArray} from '../data/array_types.js';
import {rainUniformValues} from './rain_program.js';
import {mulberry32} from '../style-spec/util/random.js';
import {rainLayout} from "./rain_attributes.js";
import {earthRadius} from '../geo/lng_lat.js';
import Texture from '../render/texture.js';
import {PrecipitationRevealParams} from './precipitation_reveal_params.js';

import type VertexBuffer from '../gl/vertex_buffer.js';
import type {vec4} from 'gl-matrix';
import type IndexBuffer from '../gl/index_buffer.js';
import type Painter from '../render/painter.js';

function generateUniformDistributedPointsInsideCube(pointsCount: number): Array<vec3> {
    const sRand = mulberry32(1323123451230);

    const points: Array<vec3> = [];
    for (let i = 0; i < pointsCount; ++i) {
        const vx = -1 + 2 * sRand();
        const vy = -1 + 2 * sRand();
        const vz = -1 + 2 * sRand();

        points.push(vec3.fromValues(vx, vy, vz));
    }

    return points;
}

export class Rain {
    particlesVx: VertexBuffer | null | undefined;
    particlesIdx: IndexBuffer | null | undefined;
    particlesCount: number;
    particlesSegments: SegmentVector;
    startTime: number;
    prevTime: number;
    accumulatedTimeFromStart: number;

    screenTexture: Texture | null | undefined;

    _revealParams: PrecipitationRevealParams;

    _offsetXPrev: number | undefined;
    _offsetYPrev: number | undefined;
    _elevationPrev: number | undefined;

    _accumulatedOffsetX: number;
    _accumulatedOffsetY: number;
    _accumulatedElevation: number;

    _params: {
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
    };

    constructor(painter: Painter) {

        this.accumulatedTimeFromStart = 0;
        this.startTime = Date.now() / 1000;
        this.prevTime = Date.now() / 1000;

        this._accumulatedOffsetX = 0;
        this._accumulatedOffsetY = 0;
        this._accumulatedElevation = 0;

        this._params = {
            intensity: 1.0,
            timeFactor: 1.0,
            velocityConeAperture: 5.0,
            velocity: 100.0,
            boxSize: 1200,
            dropletSizeX: 1.0,
            dropletSizeYScale: 10.0,
            distortionStrength: 50.0,
            screenThinning: {
                intensity: 0.0,
                start: 0.56,
                range: 0.37,
                fadePower: 0,
                affectedRatio: 1.0,
                particleOffset: -0.2
            },
            color: {r: 0.57, g: 0.57, b: 0.57, a: 0.19},
            direction: {x: -50, y: -35},
            shapeDirPower: 2.0
        };

        const tp = painter.tp;

        const scope = ["Precipitation", "Rain"];
        this._revealParams = new PrecipitationRevealParams(painter.tp, scope);
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

        this.particlesCount = 16000;
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
            this.particlesSegments = SegmentVector.simpleSegment(0, 0, vertices.length, triangles.length);
        }
    }

    destroy() {
    }

    draw(painter: Painter) {
        // Global parameters
        const gp = this._revealParams;
        const zoom = painter.transform.zoom;
        const lerpClamp = (a: number, b: number, t1: number, t2: number, tMid: number,) => {
            const t = clamp((tMid - t1) / (t2 - t1), 0, 1);
            return (1 - t) * a + t * b;
        };
        if (gp.revealStart > zoom) { return; }
        const revealFactor = lerpClamp(0, 1, gp.revealStart, gp.revealStart + gp.revealRange, zoom);

        if (!this.particlesVx || !this.particlesIdx) {
            return;
        }

        const context = painter.context;
        const gl = context.gl;

        //
        // Fill screen texture
        //

        const tr = painter.transform;

        if (!this.screenTexture || this.screenTexture.size[0] !== painter.width || this.screenTexture.size[1] !== painter.height) {
            this.screenTexture = new Texture(context, {width: painter.width, height: painter.height, data: null}, gl.RGBA8);
        }

        if (this._params.distortionStrength > 0) {
            context.activeTexture.set(gl.TEXTURE0);
            this.screenTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, painter.width, painter.height);
        }

        const curTime = Date.now() / 1000;
        this.accumulatedTimeFromStart += (curTime - this.prevTime) * this._params.timeFactor;

        this.prevTime = curTime;

        const ppmScale = tr.pixelsPerMeter / 4.25;

        const program = painter.getOrCreateProgram('rainParticle');

        const projectionMatrix = tr.starsProjMatrix;

        const orientation = quat.identity([] as any);

        quat.rotateX(orientation, orientation, degToRad(90) - tr._pitch);
        quat.rotateZ(orientation, orientation, -tr.angle);

        const rotationMatrix = mat4.fromQuat(new Float32Array(16), orientation);
        const swapAxesT = mat4.fromValues(1, 0, 0, 0,
            0, 0, 1, 0,
            0, -1, 0, 0,
            0, 0, 0, 1);
        const swapAxes = mat4.transpose([] as any, swapAxesT);
        const modelviewMatrix = mat4.multiply([] as any, swapAxes, rotationMatrix);

        const options = tr.getFreeCameraOptions();

        const cameraMercatorPos = options.position;

        const elevation = cameraMercatorPos.toAltitude();

        const latLng = cameraMercatorPos.toLngLat();
        const lng = degToRad(latLng.lng);
        const lat = degToRad(latLng.lat);

        // Mercator meters
        const offsetXCur = lng * earthRadius;
        const offsetYCur = earthRadius * Math.log(Math.tan(Math.PI / 4 + lat / 2));

        if (this._offsetXPrev === undefined) {
            this._offsetXPrev = 0;
            this._offsetYPrev = 0;
            this._elevationPrev = 0;

            this._accumulatedOffsetX = 0;
            this._accumulatedOffsetY = 0;
            this._accumulatedElevation = 0;
        } else {
            const deltaX = -this._offsetXPrev + offsetXCur;
            const deltaY = -this._offsetYPrev + offsetYCur;
            const deltaE = -this._elevationPrev + elevation;

            this._accumulatedOffsetX += deltaX * ppmScale;
            this._accumulatedOffsetY += deltaY * ppmScale;
            this._accumulatedElevation += deltaE * ppmScale;

            this._offsetXPrev = offsetXCur;
            this._offsetYPrev = offsetYCur;
            this._elevationPrev = elevation;
        }

        painter.uploadCommonUniforms(context, program);

        context.activeTexture.set(gl.TEXTURE0);
        this.screenTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        const depthMode = new DepthMode(painter.context.gl.ALWAYS, DepthMode.ReadOnly, painter.depthRangeFor3D);

        const rainDirection: vec3 = [-this._params.direction.x, this._params.direction.y, -100];
        vec3.normalize(rainDirection, rainDirection);

        const colorVec: vec4 = [this._params.color.r, this._params.color.g, this._params.color.b, this._params.color.a];

        const drawParticlesBox = (boxSize: number, distortionOnly: boolean) => {
            const offsetX = this._accumulatedOffsetX;
            const offsetY = this._accumulatedOffsetY;
            const offsetZ = this._accumulatedElevation;

            const wrappedOffsetX = offsetX - Math.floor(offsetX / boxSize) * boxSize;
            const wrappedOffsetY = offsetY - Math.floor(offsetY / boxSize) * boxSize;
            const wrappedOffsetZ = offsetZ - Math.floor(offsetZ / boxSize) * boxSize;

            const camPos: vec3 = [-wrappedOffsetX, -wrappedOffsetY, -wrappedOffsetZ];

            const sizeX = this._params.dropletSizeX;
            const sizeY = this._params.dropletSizeX * this._params.dropletSizeYScale;

            const thinningX = painter.width  / 2;
            const thinningY = painter.height  / 2;

            const dp = this._params;

            const thinningStart = lerpClamp(0, dp.screenThinning.start, 0, 1, dp.screenThinning.intensity);
            const thinningRange = lerpClamp(0.001, dp.screenThinning.range, 0, 1, dp.screenThinning.intensity);
            const thinningParticleOffset = lerpClamp(0.0, dp.screenThinning.particleOffset, 0, 1, dp.screenThinning.intensity);

            const uniforms = rainUniformValues({
                modelview: modelviewMatrix,
                projection: projectionMatrix,
                time: this.accumulatedTimeFromStart,
                camPos,
                velocityConeAperture: this._params.velocityConeAperture,
                velocity: this._params.velocity,
                boxSize,
                rainDropletSize: [sizeX, sizeY],
                distortionStrength: this._params.distortionStrength,
                rainDirection,
                color: colorVec,
                screenSize: [tr.width, tr.height],
                thinningCenterPos: [thinningX, thinningY],
                thinningShape: [thinningStart, thinningRange, Math.pow(10.0, dp.screenThinning.fadePower)],
                thinningAffectedRatio: dp.screenThinning.affectedRatio,
                thinningParticleOffset,
                shapeDirectionalPower: dp.shapeDirPower,
                mode: distortionOnly ? 0 : 1
            });

            const count = Math.round(revealFactor * this._params.intensity * this.particlesCount);
            const particlesSegments = SegmentVector.simpleSegment(0, 0, count * 4, count * 2);

            program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled,
                ColorMode.alphaBlended, CullFaceMode.disabled, uniforms, "rain_particles",
                this.particlesVx, this.particlesIdx, particlesSegments, {});
        };

        // Distortion only
        if (this._params.distortionStrength > 0) {
            drawParticlesBox(this._params.boxSize, true);
        }

        // Same data alpha blended only
        drawParticlesBox(this._params.boxSize, false);
    }

}
