// @flow

import {
    UniformMatrix4f
} from '../../../src/render/uniform_binding.js';

import type {UniformValues} from '../../../src/render/uniform_binding.js';
import type Context from '../../../src/gl/context.js';

export type ModelUniformsType = {
    'u_matrix': UniformMatrix4f
};

const modelUniforms = (context: Context): ModelUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const modelUniformValues = (matrix: Float32Array): UniformValues<ModelUniformsType> => ({
    'u_matrix': matrix
});

export {
    modelUniforms,
    modelUniformValues
};
