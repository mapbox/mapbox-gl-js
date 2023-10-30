// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import Program from './program.js';
import type SourceCache from '../source/source_cache.js';
import SkyboxGeometry from './skybox_geometry.js';
import {skyboxUniformValues, skyboxGradientUniformValues} from './program/skybox_program.js';
import {skyboxCaptureUniformValues} from './program/skybox_capture_program.js';
import SkyLayer from '../style/style_layer/sky_style_layer.js';
import type Painter from './painter.js';
import {mat3, mat4} from 'gl-matrix';
import assert from 'assert';

import type {Mat4} from 'gl-matrix';
import {globeToMercatorTransition} from '../geo/projection/globe_util.js';

export default drawSky;

function drawSky(painter: Painter, sourceCache: SourceCache, layer: SkyLayer) {
    const tr = painter.transform;
    // Note: we render sky for globe projection during the transition to mercator or if atmosphere is disabled.
    const transitionOpacity = !painter._atmosphere ? 1.0 : globeToMercatorTransition(tr.zoom);
    const opacity = layer.paint.get('sky-opacity') * transitionOpacity;
    if (opacity === 0) {
        return;
    }

    const context = painter.context;
    const type = layer.paint.get('sky-type');
    const depthMode = new DepthMode(context.gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const temporalOffset = (painter.frameCounter / 1000.0) % 1;

    if (type === 'atmosphere') {
        if (painter.renderPass === 'offscreen') {
            if (layer.needsSkyboxCapture(painter)) {
                captureSkybox(painter, layer, 32, 32);
                layer.markSkyboxValid(painter);
            }
        } else if (painter.renderPass === 'sky') {
            drawSkyboxFromCapture(painter, layer, depthMode, opacity, temporalOffset);
        }
    } else if (type === 'gradient') {
        if (painter.renderPass === 'sky') {
            drawSkyboxGradient(painter, layer, depthMode, opacity, temporalOffset);
        }
    } else {
        assert(false, `${type} is unsupported sky-type`);
    }
}

function drawSkyboxGradient(painter: Painter, layer: SkyLayer, depthMode: DepthMode, opacity: number, temporalOffset: number) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const program = painter.getOrCreateProgram('skyboxGradient');

    // Lazily initialize geometry and texture if they havent been created yet.
    if (!layer.skyboxGeometry) {
        layer.skyboxGeometry = new SkyboxGeometry(context);
    }
    context.activeTexture.set(gl.TEXTURE0);
    let colorRampTexture = layer.colorRampTexture;
    if (!colorRampTexture) {
        colorRampTexture = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
    }
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    const uniformValues = skyboxGradientUniformValues(
        transform.skyboxMatrix,
        layer.getCenter(painter, false),
        layer.paint.get('sky-gradient-radius'),
        opacity,
        temporalOffset
    );

    painter.uploadCommonUniforms(context, program);

    program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled,
        painter.colorModeForRenderPass(), CullFaceMode.backCW,
        uniformValues, 'skyboxGradient', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

function drawSkyboxFromCapture(painter: Painter, layer: SkyLayer, depthMode: DepthMode, opacity: number, temporalOffset: number) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const program = painter.getOrCreateProgram('skybox');

    context.activeTexture.set(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, layer.skyboxTexture);

    const uniformValues = skyboxUniformValues(transform.skyboxMatrix, layer.getCenter(painter, false), 0, opacity, temporalOffset);

    painter.uploadCommonUniforms(context, program);

    program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled,
        painter.colorModeForRenderPass(), CullFaceMode.backCW,
        uniformValues, 'skybox', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

function drawSkyboxFace(painter: Painter, layer: SkyLayer, program: Program<any>, faceRotate: Mat4, sunDirection: [number, number, number], i: number) {
    const context = painter.context;
    const gl = context.gl;

    const atmosphereColor = layer.paint.get('sky-atmosphere-color');
    const atmosphereHaloColor = layer.paint.get('sky-atmosphere-halo-color');
    const sunIntensity = layer.paint.get('sky-atmosphere-sun-intensity');

    const uniformValues = skyboxCaptureUniformValues(
        mat3.fromMat4(mat3.create(), faceRotate),
        sunDirection,
        sunIntensity,
        atmosphereColor,
        atmosphereHaloColor);

    const glFace = gl.TEXTURE_CUBE_MAP_POSITIVE_X + i;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, glFace, layer.skyboxTexture, 0);

    program.draw(painter, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.frontCW,
        uniformValues, 'skyboxCapture', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

function captureSkybox(painter: Painter, layer: SkyLayer, width: number, height: number) {
    const context = painter.context;
    const gl = context.gl;
    let fbo = layer.skyboxFbo;

    // Using absence of fbo as a signal for lazy initialization of all resources, cache resources in layer object
    if (!fbo) {
        fbo = layer.skyboxFbo = context.createFramebuffer(width, height, true, null);
        layer.skyboxGeometry = new SkyboxGeometry(context);
        layer.skyboxTexture = context.gl.createTexture();

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, layer.skyboxTexture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        for (let i = 0; i < 6; ++i) {
            const glFace = gl.TEXTURE_CUBE_MAP_POSITIVE_X + i;

            // The format here could be RGB, but render tests are not happy with rendering to such a format
            gl.texImage2D(glFace, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, width, height]);

    const sunDirection = layer.getCenter(painter, true);
    const program = painter.getOrCreateProgram('skyboxCapture');
    const faceRotate = new Float64Array(16);

    // +x;
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, -Math.PI * 0.5);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 0);
    // -x
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, Math.PI * 0.5);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 1);
    // +y
    mat4.identity(faceRotate);
    mat4.rotateX(faceRotate, faceRotate, -Math.PI * 0.5);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 2);
    // -y
    mat4.identity(faceRotate);
    mat4.rotateX(faceRotate, faceRotate, Math.PI * 0.5);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 3);
    // +z
    mat4.identity(faceRotate);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 4);
    // -z
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, Math.PI);
    drawSkyboxFace(painter, layer, program, faceRotate, sunDirection, 5);

    context.viewport.set([0, 0, painter.width, painter.height]);
}
