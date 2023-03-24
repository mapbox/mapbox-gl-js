// @flow

import {
    Uniform3f,
    UniformMatrix4f,
    Uniform1f,
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues} from '../render/uniform_binding.js';
import type {Mat4} from 'gl-matrix';

export type StarsUniformsType = {
    'u_matrix': UniformMatrix4f,
    'u_up': Uniform3f,
    'u_right': Uniform3f,
    'u_intensity_multiplier': Uniform1f
};

const starsUniforms = (context: Context): StarsUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_up': new Uniform3f(context),
    'u_right': new Uniform3f(context),
    'u_intensity_multiplier': new Uniform1f(context),
});

const starsUniformValues = (
    matrix: Mat4,
    up: [number, number, number],
    right: [number, number, number],
    intensityMultiplier: number,
): UniformValues<StarsUniformsType> => ({
    'u_matrix': Float32Array.from(matrix),
    'u_up': up,
    'u_right': right,
    'u_intensity_multiplier': intensityMultiplier
});

export {starsUniforms, starsUniformValues};
