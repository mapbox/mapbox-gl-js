// @flow

import Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from './uniform_binding.js';
import type Painter from './painter';
import {mat4} from 'gl-matrix';
import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';

import {Uniform1f, Uniform2f, Uniform3f, UniformMatrix4f, Uniform1i} from './uniform_binding.js';

export type FogUniformsType = {|
    'u_cam_matrix': UniformMatrix4f,
    'u_fog_range': Uniform2f,
    'u_fog_color': Uniform3f,
    'u_fog_opacity': Uniform1f,
    'u_fog_sky_blend': Uniform1f,
    'u_fog_temporal_offset': Uniform1f,
|};

export type FogTextureUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_world': Uniform2f,
    'u_texel_size': Uniform2f,
    'u_image': Uniform1i
|};

export const fogTextureUniforms = (context: Context, locations: UniformLocations): FogTextureUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_texel_size': new Uniform2f(context, locations.u_texel_size),
    'u_image': new Uniform1i(context, locations.u_image)
});

export const fogTextureUniformValues = (
    painter: Painter,
    textureUnit: number
): UniformValues<FogTextureUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_texel_size': [1/gl.drawingBufferWidth, 1/gl.drawingBufferHeight],
        'u_image': textureUnit
    };
};

export const fogUniforms = (context: Context, locations: UniformLocations): FogUniformsType => ({
    'u_cam_matrix': new UniformMatrix4f(context, locations.u_cam_matrix),
    'u_fog_range': new Uniform2f(context, locations.u_fog_range),
    'u_fog_color': new Uniform3f(context, locations.u_fog_color),
    'u_fog_opacity': new Uniform1f(context, locations.u_fog_opacity),
    'u_fog_sky_blend': new Uniform1f(context, locations.u_fog_sky_blend),
    'u_fog_temporal_offset': new Uniform1f(context, locations.u_fog_temporal_offset),
});


export function drawFogTexture(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;

    const fbo = painter._fogDepthFBO;
    context.activeTexture.set(gl.TEXTURE0);
    painter._fogDepthTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const program = painter.useProgram('fogTexture', null, ['FOG']);
    painter.prepareDrawProgram(context, program);

   program.draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        fogTextureUniformValues(painter, 0),
        '$fog_texture', painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments);
}

export type FogDefinesType = 'FOG';