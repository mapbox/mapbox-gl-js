import {Uniform2f, Uniform3f, Uniform4f, UniformMatrix4f} from '../uniform_binding';
import type {mat4} from 'gl-matrix';
import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';

export type OcclusionUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_anchorPos']: Uniform3f;
    ['u_screenSizePx']: Uniform2f;
    ['u_occluderSizePx']: Uniform2f;
    ['u_color']: Uniform4f;
};

const occlusionUniforms = (context: Context): OcclusionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_anchorPos': new Uniform3f(context),
    'u_screenSizePx': new Uniform2f(context),
    'u_occluderSizePx': new Uniform2f(context),
    'u_color': new Uniform4f(context)
});

const occlusionUniformValues = (
    matrix: mat4,
    anchorPos: [number, number, number],
    screenSize: [number, number],
    occluderSize: [number, number],
    color: [number, number, number, number],
): UniformValues<OcclusionUniformsType> => ({
    'u_matrix': Float32Array.from(matrix),
    'u_anchorPos': anchorPos,
    'u_screenSizePx': screenSize,
    'u_occluderSizePx': occluderSize,
    'u_color': color,
});

export {occlusionUniforms, occlusionUniformValues};
