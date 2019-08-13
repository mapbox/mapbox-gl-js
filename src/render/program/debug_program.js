// @flow

import {
    UniformColor,
    UniformMatrix4f,
    Uniform2f
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Color from '../../style-spec/util/color';

export type DebugUniformsType = {|
    'u_color': UniformColor,
    'u_matrix': UniformMatrix4f
|};

export type DebugSSRectUniformsType = {|
    'u_color': UniformColor,
    'u_offset': Uniform2f,
    'u_dim': Uniform2f
|};

const debugUniforms = (context: Context, locations: UniformLocations): DebugUniformsType => ({
    'u_color': new UniformColor(context, locations.u_color),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix)
});

const debugSSRectUniforms = (context: Context, locations: UniformLocations): DebugSSRectUniformsType => ({
    'u_color': new UniformColor(context, locations.u_color),
    'u_offset': new Uniform2f(context, locations.u_offset),
    'u_dim': new Uniform2f(context, locations.u_dim)
});

const debugSSRectUniformValues = (color: Color, offset: [number, number], dim: [number, number]): UniformValues<DebugSSRectUniformsType> => ({
    'u_color': color,
    'u_offset': offset,
    'u_dim': dim,
});

const debugUniformValues = (matrix: Float32Array, color: Color): UniformValues<DebugUniformsType> => ({
    'u_matrix': matrix,
    'u_color': color
});

export { debugUniforms, debugUniformValues, debugSSRectUniforms, debugSSRectUniformValues };
