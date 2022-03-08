// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {globeToMercatorTransition} from './../geo/projection/globe_util.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import {degToRad, mapValue} from '../util/util.js';
import {vec3, mat4} from 'gl-matrix';

export default drawGlobeAtmosphere;

function project(point, m) {
    return vec3.transformMat4(point, point, m);
}

function drawGlobeAtmosphere(painter: Painter) {
    const fog = painter.style.fog;

    if (!fog) {
        return;
    }

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

    // Compute direction vectors to each corner point of the view frustum
    const frustumTl = project([-1, 1, 1], projToView);
    const frustumTr = project([1, 1, 1], projToView);
    const frustumBr = project([1, -1, 1], projToView);
    const frustumBl = project([-1, -1, 1], projToView);

    const center = [transform.globeMatrix[12], transform.globeMatrix[13], transform.globeMatrix[14]];
    const globeCenterInViewSpace = project(center, viewMatrix);
    const globeRadius = transform.worldSize / 2.0 / Math.PI - 1.0;

    const fadeOutTransition = 1.0 - globeToMercatorTransition(transform.zoom);

    const fogOpacity = fog.getOpacity(transform.pitch);
    const fogColor = fog.properties.get('color');
    const fogColorUnpremultiplied = [
        fogColor.a === 0.0 ? 0 : fogColor.r / fogColor.a,
        fogColor.a === 0.0 ? 0 : fogColor.g / fogColor.a,
        fogColor.a === 0.0 ? 0 : fogColor.b / fogColor.a,
        fogColor.a
    ];
    const skyColor = fog.properties.get('sky-color');
    const skyColorUnpremultiplied = [
        skyColor.a === 0.0 ? 0 : skyColor.r / skyColor.a,
        skyColor.a === 0.0 ? 0 : skyColor.g / skyColor.a,
        skyColor.a === 0.0 ? 0 : skyColor.b / skyColor.a,
        skyColor.a
    ];

    const latlon = [
        degToRad(transform._center.lat) / (Math.PI * 0.5),
        degToRad(transform._center.lng) / Math.PI
    ];

    const starIntensity = mapValue(fog.properties.get('star-intensity'), 0.0, 1.0, 0.0, 0.25);

    const uniforms = atmosphereUniformValues(
        frustumTl,
        frustumTr,
        frustumBr,
        frustumBl,
        globeCenterInViewSpace,
        globeRadius,
        fadeOutTransition,
        fog.properties.get('horizon-blend'),
        fogColorUnpremultiplied,
        skyColorUnpremultiplied,
        latlon,
        starIntensity);

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
