// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {globeToMercatorTransition} from './../geo/projection/globe_util.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import {vec3, mat4} from 'gl-matrix';

export default drawGlobeAtmosphere;

function project(point, m) {
    return vec3.transformMat4(point, point, m);
}

function drawGlobeAtmosphere(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const program = painter.useProgram('globeAtmosphere');

    // Render the gradient atmosphere by casting rays from screen pixels and determining their
    // closest distance to the globe. This is done in view space where camera is located in the origo
    // facing -z direction.
    const offset = transform.centerOffset;
    const cameraToClip = transform._camera.getCameraToClipPerspective(transform._fov, transform.width / transform.height, transform._nearZ, transform._farZ);

    cameraToClip[8] = -offset.x * 2 / transform.width;
    cameraToClip[9] = offset.y * 2 / transform.height;

    const clipToCamera = mat4.invert([], cameraToClip);
    const viewMatrix = mat4.mul([], clipToCamera, transform.projMatrix);

    // Compute direction vectors to each corner point of the view frustum
    const frustumTl = project([-1, 1, 1], clipToCamera);
    const frustumTr = project([1, 1, 1], clipToCamera);
    const frustumBr = project([1, -1, 1], clipToCamera);
    const frustumBl = project([-1, -1, 1], clipToCamera);

    const center = [transform.globeMatrix[12], transform.globeMatrix[13], transform.globeMatrix[14]];
    const globeCenterInViewSpace = project(center, viewMatrix);
    const globeRadius = transform.worldSize / 2.0 / Math.PI - 1.0;

    const fadeOutTransition = 1.0 - globeToMercatorTransition(transform.zoom);

    const uniforms = atmosphereUniformValues(
        frustumTl,
        frustumTr,
        frustumBr,
        frustumBl,
        globeCenterInViewSpace,
        globeRadius,
        fadeOutTransition,          // opacity
        2.0,                        // fadeout range
        [1.0, 1.0, 1.0],            // start color
        [0.0118, 0.7451, 0.9882]);  // end color

    painter.prepareDrawProgram(context, program);

    const sharedBuffers = painter.globeSharedBuffers;
    if (sharedBuffers) {
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
            ColorMode.alphaBlended, CullFaceMode.backCW, uniforms, "skybox",
            sharedBuffers.atmosphereVertexBuffer,
            sharedBuffers.atmosphereIndexBuffer,
            sharedBuffers.atmosphereSegments);
    }
}
