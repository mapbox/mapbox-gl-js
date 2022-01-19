// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {calculateGlobeMatrix, globeToMercatorTransition} from './../geo/projection/globe.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import {vec3, mat4} from 'gl-matrix';
import browser from '../util/browser.js';
import Color from '../style-spec/util/color.js';

export default drawGlobeAtmosphere;

function drawGlobeAtmosphere(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const program = painter.useProgram('globeAtmosphere');

    // Compute center and approximate radius of the globe on screen coordinates
    const viewMatrix = transform._camera.getWorldToCamera(transform.worldSize, 1.0);
    const viewToProj = transform._camera.getCameraToClipPerspective(transform._fov, transform.width / transform.height, transform._nearZ, transform._farZ);
    const globeToView = mat4.mul([], viewMatrix, calculateGlobeMatrix(transform, transform.worldSize));
    const viewToScreen = mat4.mul([], transform.labelPlaneMatrix, viewToProj);

    const centerOnViewSpace = vec3.transformMat4([], [0, 0, 0], globeToView);
    const radiusOnViewSpace = vec3.add([], centerOnViewSpace, [transform.worldSize / Math.PI / 2.0, 0, 0]);

    const centerOnScreen = vec3.transformMat4([], centerOnViewSpace, viewToScreen);
    const radiusOnScreen = vec3.transformMat4([], radiusOnViewSpace, viewToScreen);

    const pixelRadius = vec3.length(vec3.sub([], radiusOnScreen, centerOnScreen));
    const fadeOutTransition = 1.0 - globeToMercatorTransition(transform.zoom);

    let startColor = { r: 1, g: 1, b: 1, a: 1 };
    let endColor = { r: 0.0118, g: 0.7451, b: 0.9882, a: 1 };
    let gradientRadius = 2.0;
    const atmosphere = transform.projection.atmosphere;

    if (atmosphere) {
        startColor = Color.parse(atmosphere["gradient-inner-color"]) || startColor;
        endColor = Color.parse(atmosphere["gradient-outer-color"]) || endColor;
        gradientRadius = atmosphere["gradient-outer-radius"] || gradientRadius;
    }

    const uniforms = atmosphereUniformValues(
        centerOnScreen,
        pixelRadius,
        [transform.width, transform.height],
        browser.devicePixelRatio,
        fadeOutTransition,          // opacity
        gradientRadius,
        [startColor.r, startColor.g, startColor.b],
        [endColor.r, endColor.g, endColor.b]);

        //2.0,                        // fadeout range
        //[1.0, 1.0, 1.0],            // start color
        //[0.0118, 0.7451, 0.9882]);  // end color

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
