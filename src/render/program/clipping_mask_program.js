// @flow

import { UniformMatrix4fv, Uniforms } from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';

export type ClippingMaskUniformsType = {|
    'u_matrix': UniformMatrix4fv
|};

const clippingMaskUniforms = (context: Context, locations: UniformLocations): Uniforms<ClippingMaskUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix)
});

const clippingMaskUniformValues = (matrix: Float32Array): UniformValues<ClippingMaskUniformsType> => ({
    'u_matrix': matrix
});

export { clippingMaskUniforms, clippingMaskUniformValues };
