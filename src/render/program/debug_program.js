// @flow

import {
    Uniform4fv,
    UniformMatrix4fv,
    Uniforms
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';
import type Color from '../../style-spec/util/color';

export type DebugUniformsType = {|
    'u_color': Uniform4fv,
    'u_matrix': UniformMatrix4fv
|};

const debugUniforms = (context: Context): Uniforms<DebugUniformsType> => new Uniforms({
    'u_color': new Uniform4fv(context),
    'u_matrix': new UniformMatrix4fv(context)
});

const debugUniformValues = (matrix: Float32Array, color: Color): UniformValues<DebugUniformsType> => ({
    'u_matrix': matrix,
    'u_color': [color.r, color.g, color.b, color.a]
});

export { debugUniforms, debugUniformValues };
