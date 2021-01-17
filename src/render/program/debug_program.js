// @flow

import {
    UniformColor,
    UniformMatrix4f,
    Uniform1i,
    Uniform1f,
    Uniform2f
} from '../uniform_binding';
import {mat4} from 'gl-matrix';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Color from '../../style-spec/util/color';

export type DebugUniformsType = {|
    'u_color': UniformColor,
    'u_matrix': UniformMatrix4f,
    'u_overlay': Uniform1i,
    'u_overlay_scale': Uniform1f
|};

export type DebugTextureUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_world': Uniform2f,
    'u_image': Uniform1i
|};

const debugUniforms = (context: Context, locations: UniformLocations): DebugUniformsType => ({
    'u_color': new UniformColor(context, locations.u_color),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_overlay': new Uniform1i(context, locations.u_overlay),
    'u_overlay_scale':  new Uniform1f(context, locations.u_overlay_scale),
});

const debugUniformValues = (matrix: Float32Array, color: Color, scaleRatio: number = 1): UniformValues<DebugUniformsType> => ({
    'u_matrix': matrix,
    'u_color': color,
    'u_overlay': 0,
    'u_overlay_scale': scaleRatio
});

const debugTextureUniforms = (context: Context, locations: UniformLocations): DebugTextureUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image)
});

const debugTextureUniformValues = (
    painter: Painter,
    textureUnit: number
): UniformValues<DebugTextureUniformsType> => {
    mat4
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': textureUnit
    };
};

export {debugUniforms, debugUniformValues, debugTextureUniforms, debugTextureUniformValues};
