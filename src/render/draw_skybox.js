// @flow

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import Skybox from './skybox';
import {skyboxUniformValues} from './program/skybox_program';

import type Painter from './painter';

export default drawSkybox;

function drawSkybox(painter: Painter, skybox: Skybox) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const program = painter.useProgram('skybox');

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skybox.textureCube.texture);

    const uniformValues = skyboxUniformValues(transform.skyboxMatrix, 0);

    program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled,
        uniformValues, 'skybox', skybox.skyboxVertexBuffer,
        skybox.skyboxIndexBuffer, skybox.segment);
}
