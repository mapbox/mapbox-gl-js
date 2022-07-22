// @flow

import {
    UniformColor,
    UniformMatrix4f,
    Uniform1i,
    Uniform1f
} from '../uniform_binding.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';
import type Color from '../../style-spec/util/color.js';

export type DebugUniformsType = {|
    'u_color': UniformColor,
    'u_matrix': UniformMatrix4f,
    'u_overlay': Uniform1i,
    'u_overlay_scale': Uniform1f
|};

const debugUniforms = (context: Context): DebugUniformsType => ({
    'u_color': new UniformColor(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_overlay': new Uniform1i(context),
    'u_overlay_scale':  new Uniform1f(context),
});

const debugUniformValues = (matrix: Float32Array, color: Color, scaleRatio: number = 1): UniformValues<DebugUniformsType> => ({
    'u_matrix': matrix,
    'u_color': color,
    'u_overlay': 0,
    'u_overlay_scale': scaleRatio
});

export {debugUniforms, debugUniformValues};

export type DebugDefinesType = 'PROJECTION_GLOBE_VIEW';
