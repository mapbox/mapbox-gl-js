// @flow

import { UniformMatrix4fv } from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';

type u_matrix = UniformMatrix4fv;

export type ClippingMaskUniformsType = [ u_matrix ];

const clippingMaskUniforms = (context: Context, locations: UniformLocations): ClippingMaskUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix'])
]);

const clippingMaskUniformValues = (matrix: Float32Array): UniformValues<ClippingMaskUniformsType> => ([
    matrix
]);

export { clippingMaskUniforms, clippingMaskUniformValues };
