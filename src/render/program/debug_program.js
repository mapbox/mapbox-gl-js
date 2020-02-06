// @flow

import {
    UniformColor,
    UniformMatrix4f,
    Uniform1i
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Color from '../../style-spec/util/color';

export type DebugUniformsType = {|
    'u_color': UniformColor,
    'u_matrix': UniformMatrix4f,
    'u_overlay': Uniform1i
|};

const debugUniforms = (context: Context, locations: UniformLocations): DebugUniformsType => ({
    'u_color': new UniformColor(context, locations.u_color),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_overlay': new Uniform1i(context, locations.u_overlay)
});

const debugUniformValues = (matrix: Float32Array, color: Color): UniformValues<DebugUniformsType> => ({
    'u_matrix': matrix,
    'u_color': color,
    'u_overlay': 0
});

export {debugUniforms, debugUniformValues};
