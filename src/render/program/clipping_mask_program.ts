import {UniformMatrix4f} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';

export type ClippingMaskUniformsType = {
    ['u_matrix']: UniformMatrix4f;
};

const clippingMaskUniforms = (context: Context): ClippingMaskUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const clippingMaskUniformValues = (matrix: Float32Array): UniformValues<ClippingMaskUniformsType> => ({
    'u_matrix': matrix
});

export {clippingMaskUniforms, clippingMaskUniformValues};
