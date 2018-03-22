// @flow

import {
    UniformColor,
    UniformMatrix4fv
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Color from '../../style-spec/util/color';

type u_color = UniformColor;
type u_matrix = UniformMatrix4fv;

export type DebugUniformsType = [ u_color, u_matrix ];

const debugUniforms = (context: Context, locations: UniformLocations): DebugUniformsType => ([
    new UniformColor(context, locations['u_color']),
    new UniformMatrix4fv(context, locations['u_matrix'])
]);

const debugUniformValues = (matrix: Float32Array, color: Color): UniformValues<DebugUniformsType> => ([
    matrix,
    color
]);

export { debugUniforms, debugUniformValues };
