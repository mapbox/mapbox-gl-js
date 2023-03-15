// @flow

import {UniformMatrix4f} from '../../../src/render/uniform_binding.js';
import type {UniformValues} from '../../../src/render/uniform_binding.js';
import type Context from '../../../src/gl/context.js';

export type GroundShadowUniformsType = {
    'u_matrix': UniformMatrix4f
};

const groundShadowUniforms = (context: Context): GroundShadowUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const groundShadowUniformValues = (matrix: Float32Array): UniformValues<GroundShadowUniformsType> => ({
    'u_matrix': matrix
});

export {
    groundShadowUniforms,
    groundShadowUniformValues
};
