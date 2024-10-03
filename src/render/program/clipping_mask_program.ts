import {UniformMatrix4f} from '../uniform_binding';

import type {mat4} from 'gl-matrix';
import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';

export type ClippingMaskUniformsType = {
    ['u_matrix']: UniformMatrix4f;
};

const clippingMaskUniforms = (context: Context): ClippingMaskUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const clippingMaskUniformValues = (matrix: mat4): UniformValues<ClippingMaskUniformsType> => ({
    'u_matrix': matrix as Float32Array
});

export {clippingMaskUniforms, clippingMaskUniformValues};
