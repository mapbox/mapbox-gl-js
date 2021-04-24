// @flow

import Context from '../gl/context.js';
import type {UniformLocations} from './uniform_binding.js';

import {Uniform2f, Uniform3f} from './uniform_binding.js';

export type HazeUniformsType = {|
    'u_haze_range': Uniform2f,
    'u_haze_color_linear': Uniform3f,
|};

export const hazeUniforms = (context: Context, locations: UniformLocations): HazeUniformsType => ({
    'u_haze_range': new Uniform2f(context, locations.u_haze_range),
    'u_haze_color_linear': new Uniform3f(context, locations.u_haze_color_linear),
});
