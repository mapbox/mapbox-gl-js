// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {globeToMercatorTransition} from './../geo/projection/globe_util.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import {vec3, mat4} from 'gl-matrix';
import type {Vec3, Mat4} from 'gl-matrix';
import {getColumn} from '../util/util.js';

export default drawGlobeAtmosphere;

function drawGlobeAtmosphere(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const program = painter.useProgram('globeAtmosphere');

    // Render the gradient atmosphere by casting rays from screen pixels and determining their
    // closest distance to the globe. This is done in view space where camera is located in the origo
    // facing -z direction.
    const viewMatrix = transform._camera.getWorldToCamera(transform.worldSize, 1.0);
    const viewToProj = transform._camera.getCameraToClipPerspective(transform._fov, transform.width / transform.height, transform._nearZ, transform._farZ);
    const projToView = mat4.invert([], viewToProj);

    const project = (point: Vec3, m: Mat4): [number, number, number] => {
        vec3.transformMat4(point, point, m);
        return [point[0], point[1], point[2]];
    };

    // Compute direction vectors to each corner point of the view frustum
    const frustumTl = project([-1, 1, 1], projToView);
    const frustumTr = project([1, 1, 1], projToView);
    const frustumBr = project([1, -1, 1], projToView);
    const frustumBl = project([-1, -1, 1], projToView);

    const center = getColumn(transform.globeMatrix, 3);
    const globeCenterInViewSpace = project([center[0], center[1], center[2]], viewMatrix);
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
