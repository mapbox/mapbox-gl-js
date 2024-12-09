import {
    Uniform4f,
    Uniform3f,
    Uniform2f,
    UniformMatrix4f,
    Uniform1f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues} from '../render/uniform_binding.js';
import type {mat4} from 'gl-matrix';

export type SnowDefinesType = 'TERRAIN';

export type SnowUniformsType = {
    'u_modelview': UniformMatrix4f,
    'u_projection': UniformMatrix4f,
    'u_time': Uniform1f,
    'u_cam_pos': Uniform3f,
    'u_velocityConeAperture': Uniform1f,
    'u_velocity': Uniform1f,
    'u_horizontalOscillationRadius': Uniform1f,
    'u_horizontalOscillationRate': Uniform1f,
    'u_boxSize': Uniform1f,
    'u_billboardSize': Uniform1f,
    'u_simpleShapeParameters': Uniform2f,
    'u_screenSize': Uniform2f,
    'u_thinningCenterPos': Uniform2f,
    'u_thinningShape': Uniform3f,
    'u_thinningAffectedRatio': Uniform1f,
    'u_thinningParticleOffset': Uniform1f,
    'u_particleColor': Uniform4f,
    'u_direction': Uniform3f,
};

const snowUniforms = (context: Context): SnowUniformsType => ({
    'u_modelview': new UniformMatrix4f(context),
    'u_projection': new UniformMatrix4f(context),
    'u_time': new Uniform1f(context),
    'u_cam_pos': new Uniform3f(context),
    'u_velocityConeAperture': new Uniform1f(context),
    'u_velocity': new Uniform1f(context),
    'u_horizontalOscillationRadius': new Uniform1f(context),
    'u_horizontalOscillationRate': new Uniform1f(context),
    'u_boxSize': new Uniform1f(context),
    'u_billboardSize': new Uniform1f(context),
    'u_simpleShapeParameters': new Uniform2f(context),
    'u_screenSize': new Uniform2f(context),
    'u_thinningCenterPos': new Uniform2f(context),
    'u_thinningShape': new Uniform3f(context),
    'u_thinningAffectedRatio': new Uniform1f(context),
    'u_thinningParticleOffset': new Uniform1f(context),
    'u_particleColor': new Uniform4f(context),
    'u_direction': new Uniform3f(context),
});

const snowUniformValues = (values: {
    modelview: mat4,
    projection: mat4,
    time: number,
    camPos: [number, number, number],
    velocityConeAperture: number,
    velocity: number,
    horizontalOscillationRadius: number,
    horizontalOscillationRate: number,
    boxSize: number,
    billboardSize: number,
    simpleShapeParameters: [number, number],
    screenSize: [number, number],
    thinningCenterPos: [number, number],
    thinningShape: [number, number, number],
    thinningAffectedRatio: number,
    thinningParticleOffset: number,
    color: [number, number, number, number],
    direction: [number, number, number],
}
): UniformValues<SnowUniformsType> => ({
    'u_modelview': Float32Array.from(values.modelview),
    'u_projection': Float32Array.from(values.projection),
    'u_time': values.time,
    'u_cam_pos': values.camPos,
    'u_velocityConeAperture': values.velocityConeAperture,
    'u_velocity': values.velocity,
    'u_horizontalOscillationRadius': values.horizontalOscillationRadius,
    'u_horizontalOscillationRate': values.horizontalOscillationRate,
    'u_boxSize': values.boxSize,
    'u_billboardSize': values.billboardSize,
    'u_simpleShapeParameters': values.simpleShapeParameters,
    'u_screenSize': values.screenSize,
    'u_thinningCenterPos': values.thinningCenterPos,
    'u_thinningShape': values.thinningShape,
    'u_thinningAffectedRatio': values.thinningAffectedRatio,
    'u_thinningParticleOffset': values.thinningParticleOffset,
    'u_particleColor': values.color,
    'u_direction': values.direction
});

export {snowUniforms, snowUniformValues};
