// @flow

import {UniformMatrix4f} from '../uniform_binding.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';

export type ClippingMaskUniformsType = {|
    'u_matrix': UniformMatrix4f
|};

const clippingMaskUniforms = (context: Context): ClippingMaskUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const clippingMaskUniformValues = (matrix: Float32Array): UniformValues<ClippingMaskUniformsType> => ({
    'u_matrix': matrix
});

export {clippingMaskUniforms, clippingMaskUniformValues};
