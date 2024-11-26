// @flow
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {default as ColorMode} from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {degToRad, clamp} from '../util/util';
import {vec3, mat4, quat} from 'gl-matrix';
import SegmentVector from '../data/segment';
import {TriangleIndexArray, SnowVertexArray} from '../data/array_types';
import {snowUniformValues} from './snow_program';
import {mulberry32} from '../style-spec/util/random';
import {snowLayout} from "./snow_attributes";
import {earthRadius} from '../geo/lng_lat';
import {PrecipitationRevealParams} from './precipitation_reveal_params';

import type Painter from '../render/painter';
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';
import type {vec2, vec4} from 'gl-matrix';

function generateUniformDistributedPointsInsideCube(pointsCount: number): Array<vec3> {
    const sRand = mulberry32(1323123451230);
    // const sRand = Math.random;

    const points: Array<vec3> = [];
    for (let i = 0; i < pointsCount; ++i) {
        const vx = -1 + 2 * sRand();
        const vy = -1 + 2 * sRand();
        const vz = -1 + 2 * sRand();

        points.push(vec3.fromValues(vx, vy, vz));
    }

    return points;
}

export class Snow {
    particlesVx: VertexBuffer | null | undefined;
    particlesIdx: IndexBuffer | null | undefined;
    particlesCount: number;
    particlesSegments: SegmentVector;
    startTime: number;
    prevTime: number;
    accumulatedTimeFromStart: number;

    _revealParams: PrecipitationRevealParams;

    _offsetX: number | undefined;
    _offsetY: number | undefined;
    _elevation: number | undefined;

    _offsetYPrev: number | undefined;
    _offsetXPrev: number | undefined;
    _elevationPrev: number | undefined;

    _offsetXAccum: number | undefined;
    _offsetYAccum: number | undefined;
    _elevationAccum: number | undefined;

    _params: {
        overrideStyleParameters: boolean,
        intensity: number,
        timeFactor: number,
        velocityConeAperture: number,
        velocity: number,
        horizontalOscillationRadius: number,
        horizontalOscillationRate: number,
        boxSize: number,
        billboardSize: number,
        shapeFadeStart: number,
        shapeFadePower: number,
        firstBatch: boolean,
        secondBatch: boolean,
        secondaryBoxSize: number,
        secondaryBillboardSizeScale: number,
        secondaryIntensity: number,
        screenThinning:{
            intensity: number,
            start: number,
            range: number,
            fadePower: number,
            affectedRatio: number,
            particleOffset: number
        },
        color: { r: number, g: number, b: number, a: number },
        direction: {x: number, y: number}
    };

    constructor(painter: Painter) {
        this.accumulatedTimeFromStart = 0;
        this.startTime = Date.now() / 1000;
        this.prevTime = Date.now() / 1000;

        this._offsetX = undefined;
        this._offsetY = undefined;
        this._elevation = undefined;

        this._offsetXAccum = undefined;
        this._offsetYAccum = undefined;
        this._elevationAccum = undefined;

        this._offsetXPrev = undefined;
        this._offsetYPrev = undefined;
        this._elevationPrev = undefined;

        this._params = {
            overrideStyleParameters: true,
            intensity: 1.0,
            timeFactor: 0.75,
            velocityConeAperture: 60.0,
            velocity: 60.0,
            horizontalOscillationRadius: 4.2,
            horizontalOscillationRate: 1.5,
            boxSize: 2400,
            billboardSize: 2.79,
            shapeFadeStart: 0.54,
            shapeFadePower: 0.21,
            firstBatch: true,
            secondBatch: false,
            secondaryBoxSize: 2440,
            secondaryBillboardSizeScale: 1.3,
            secondaryIntensity: 1.0,
            screenThinning: {
                intensity: 0.0,
                start: 0.56,
                range: 0.37,
                fadePower: 0,
                affectedRatio: 1.0,
                particleOffset: -0.2
            },
            color: {r: 1.0, g: 1, b: 1, a: 0.82},
            direction: {x: -50, y: -35},
        };

        const tp = painter.tp;
        const scope = ["Precipitation", "Snow"];
        this._revealParams = new PrecipitationRevealParams(painter.tp, scope);
        tp.registerParameter(this._params, scope, 'overrideStyleParameters');
        tp.registerParameter(this._params, scope, 'intensity', {min: 0.0, max: 1.0});
        tp.registerParameter(this._params, scope, 'timeFactor', {min: 0.0, max: 1.0, step: 0.01});
        tp.registerParameter(this._params, scope, 'velocityConeAperture', {min: 0.0, max: 160.0, step: 1.0});
        tp.registerParameter(this._params, scope, 'velocity', {min: 0.0, max: 500.0, step: 0.5});
        tp.registerParameter(this._params, scope, 'horizontalOscillationRadius', {min: 0.0, max: 10.0, step: 0.1});
        tp.registerParameter(this._params, scope, 'horizontalOscillationRate', {min: 0.3, max: 3.0, step: 0.05});
        tp.registerParameter(this._params, scope, 'boxSize', {min: 100.0, max: 10000.0, step: 50.0});
        tp.registerParameter(this._params, scope, 'billboardSize', {min: 0.1, max: 10.0, step: 0.01});
        tp.registerParameter(this._params, scope, 'firstBatch');
        tp.registerParameter(this._params, scope, 'secondBatch');
        tp.registerParameter(this._params, scope, 'secondaryBoxSize', {min: 100.0, max: 24000.0, step: 100.0});
        tp.registerParameter(this._params, scope, 'secondaryBillboardSizeScale', {min: 0.1, max: 10.0, step: 0.05});
        tp.registerParameter(this._params, scope, 'secondaryIntensity', {min: 0.0, max: 1.0});

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

        // const colorScope = ["Precipitation", "Snow", "Color"];
        tp.registerParameter(this._params, scope, 'color', {
            color: {type: 'float'},
        });

        tp.registerParameter(this._params, scope, 'direction', {
            picker: 'inline',
            expanded: true,
            x: {min: -200, max: 200},
            y: {min: -200, max: 200},
        });

        this.particlesCount = 16000;
    }

    update(painter: Painter) {
        const context = painter.context;

        if (!this.particlesVx) {
            const positions = generateUniformDistributedPointsInsideCube(this.particlesCount);

            const vertices = new SnowVertexArray();
            const triangles = new TriangleIndexArray();

            let base = 0;
            const sRand = mulberry32(1323123451230);
            // const sRand = Math.random;
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
            this.particlesSegments = SegmentVector.simpleSegment(0, 0, vertices.length, triangles.length);
        }
    }

    destroy() {
        if (this.particlesVx) {
            this.particlesVx.destroy();
        }

        if (this.particlesIdx) {
            this.particlesIdx.destroy();
        }
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

        const curTime = Date.now() / 1000;
        this.accumulatedTimeFromStart += (curTime - this.prevTime) * this._params.timeFactor;

        this.prevTime = curTime;

        const context = painter.context;
        const gl = context.gl;
        const tr = painter.transform;

        const program = painter.getOrCreateProgram('snowParticle');

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

        if (!cameraMercatorPos) {
            return;
        }

        const ppmScale = tr.pixelsPerMeter / 2.25;
        const altitudeMeters = cameraMercatorPos.toAltitude();
        const elevation = altitudeMeters;

        // Calculate mercator meters
        const latLngF = cameraMercatorPos.toLngLat();
        const lng = degToRad(latLngF.lng);
        const lat = degToRad(latLngF.lat);

        // Mercator meters
        const offsetXCur = lng * earthRadius;
        const offsetYCur = earthRadius * Math.log(Math.tan(Math.PI / 4 + lat / 2));

        if (this._offsetXPrev === undefined) {
            this._offsetXPrev = 0;
            this._offsetYPrev = 0;
            this._elevationPrev = 0;

            this._offsetXAccum = 0;
            this._offsetYAccum = 0;
            this._elevationAccum = 0;
        } else {
            const deltaX = -this._offsetXPrev + offsetXCur;
            const deltaY = -this._offsetYPrev + offsetYCur;
            const deltaE = -this._elevationPrev + elevation;

            this._offsetXAccum += deltaX * ppmScale;
            this._offsetYAccum += deltaY * ppmScale;
            this._elevationAccum += deltaE * ppmScale;

            this._offsetXPrev = offsetXCur;
            this._offsetYPrev = offsetYCur;
            this._elevationPrev = elevation;
        }

        painter.uploadCommonUniforms(context, program);

        const depthMode = new DepthMode(painter.context.gl.ALWAYS, DepthMode.ReadOnly, painter.depthRangeFor3D);

        const drawParticlesBox = (boxSize: number, sizeScale: number, dp: any) => {

            const offsetX = this._offsetXAccum;
            const offsetY = this._offsetYAccum;
            const offsetZ = this._elevationAccum;

            const wrappedOffsetX = offsetX - Math.floor(offsetX / boxSize) * boxSize;
            const wrappedOffsetY = offsetY - Math.floor(offsetY / boxSize) * boxSize;
            const wrappedOffsetZ = offsetZ - Math.floor(offsetZ / boxSize) * boxSize;

            const camPos: [number, number, number] = [-wrappedOffsetX, -wrappedOffsetY, -wrappedOffsetZ];

            const snowDirection: [number, number, number] = [-dp.direction.x, dp.direction.y, -100];
            vec3.normalize(snowDirection, snowDirection);

            const thinningX = tr.width  / 2;
            const thinningY = tr.height  / 2;

            const thinningStart = lerpClamp(0, dp.screenThinning.start, 0, 1, dp.screenThinning.intensity);
            const thinningRange = lerpClamp(0.001, dp.screenThinning.range, 0, 1, dp.screenThinning.intensity);
            const thinningParticleOffset = lerpClamp(0.0, dp.screenThinning.particleOffset, 0, 1, dp.screenThinning.intensity);

            const uniforms = snowUniformValues({
                modelview: modelviewMatrix,
                projection: projectionMatrix,
                time: this.accumulatedTimeFromStart,
                camPos,
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
                direction: snowDirection
            }
            );

            const count = Math.round(revealFactor * dp.intensity * this.particlesCount);
            const particlesSegments = SegmentVector.simpleSegment(0, 0, count * 4, count * 2);

            if (this.particlesVx && this.particlesIdx) {
                program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled,
                ColorMode.alphaBlended, CullFaceMode.disabled, uniforms, "snow_particles",
                this.particlesVx, this.particlesIdx, particlesSegments, {});
            }
        };

        const batchBoxSize = this._params.boxSize;
        if (this._params.firstBatch) {
            drawParticlesBox(batchBoxSize, 1.0, this._params);
        }

        const dp2 = structuredClone(this._params);
        dp2.intensity = dp2.secondaryIntensity;
        const boxSize2 = this._params.secondaryBoxSize;
        if (this._params.secondBatch) {
            drawParticlesBox(boxSize2, this._params.secondaryBillboardSizeScale, dp2);
        }
    }
}
