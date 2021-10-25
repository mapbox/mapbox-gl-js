// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Context from '../gl/context.js';
import Texture from './texture.js';
import Program from './program.js';
import type SourceCache from '../source/source_cache.js';
import SkyboxGeometry from './skybox_geometry.js';
import {GlobeVertexArray, TriangleIndexArray} from '../data/array_types.js';
import {skyboxUniformValues, skyboxGradientUniformValues} from './program/skybox_program.js';
import {atmosphereUniforms, atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import {starsUniforms, starsUniformValues} from '../terrain/globe_raster_program.js';
import {skyboxCaptureUniformValues} from './program/skybox_capture_program.js';
import SkyLayer from '../style/style_layer/sky_style_layer.js';
import type Painter from './painter.js';
import {vec3, mat3, mat4, quat} from 'gl-matrix';
import browser from '../util/browser.js';
import assert from 'assert';
import SegmentVector from '../data/segment.js';
import {createLayout} from '../util/struct_array.js';
import { Frustum } from '../util/primitives.js';
import Color from '../style-spec/util/color.js'

export default drawSky;

let starsVb;
let starsIb;
let starsSegs;

function drawStars(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;
    if (!starsVb) {
        const vertices = new GlobeVertexArray();
        const triangles = new TriangleIndexArray();
        const starCount = 1024 * 8;

        const pointOnSphere = () => {
            let x0 = 1.0;
            let x1 = 1.0;

            while (x0 * x0 + x1 * x1 >= 1.0) {
                x0 = Math.random() * 2.0 - 1.0;
                x1 = Math.random() * 2.0 - 1.0;
            }

            return vec3.normalize([], [
                2.0 * x0 * Math.sqrt(1.0 - x0 * x0 + x1 * x1),
                2.0 * x1 * Math.sqrt(1.0 - x0 * x0 + x1 * x1),
                1.0 - 2.0 * (x0 * x0 + x1 * x1)
            ]);
        };

        let vOffset = 0;
        let tOffset = 0;

        for (let i = 0; i < starCount; i++) {
            const pos = pointOnSphere();
            const m = mat4.identity([]);

            // Randomize size, orientation and color
            mat4.rotateZ(m, m, Math.random() * Math.PI * 2.0);

            const size = Math.random() * 0.7 + 0.3;
            mat4.scale(m, m, [size, size, 1.0]);

            const axis = vec3.normalize([], vec3.cross([], [0, 0, 1], pos));
            const angle = Math.acos(vec3.dot([0, 0, 1], pos));
            const rotation = quat.setAxisAngle([], axis, angle);

            mat4.multiply(m, mat4.fromQuat([], rotation), m);
            const ds = 0.001;   // default size

            const points = [
                vec3.transformMat4([], [-ds,  ds, -1.0], m),
                vec3.transformMat4([], [ ds,  ds, -1.0], m),
                vec3.transformMat4([], [ ds, -ds, -1.0], m),
                vec3.transformMat4([], [-ds, -ds, -1.0], m)
            ];

            const colorVariation = Math.random() * 0.2 + 0.1;

            for (const p of points) {
                vertices.emplaceBack(p[0], p[1], p[2], colorVariation, 0.0, 0.0, 0.0);
            }
            
            triangles.emplaceBack(vOffset + 0, vOffset + 1, vOffset + 2);
            triangles.emplaceBack(vOffset + 2, vOffset + 3, vOffset + 0);
            vOffset += 4;
            tOffset += 2;
        }

        starsVb = context.createVertexBuffer(vertices, layout.members);
        starsIb = context.createIndexBuffer(triangles);
        starsSegs = SegmentVector.simpleSegment(0, 0, vOffset, tOffset);
    }

    const program = painter.useProgram('globeStars');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.disabled, [0, 1]);
    const colorMode = ColorMode.unblended;
    const tr = painter.transform;

    // Find matrix for rotating the stars with the camera
    const matrix = tr._camera.getCameraToClipPerspective(tr._fov, tr.width / tr.height, 0.001, 1.0);

    const globeOrientation = quat.identity([]);
    quat.rotateX(globeOrientation, globeOrientation, tr._center.lat * Math.PI / 180);
    quat.rotateY(globeOrientation, globeOrientation, -tr._center.lng * Math.PI / 180);
    const globeMat = mat4.fromQuat([], globeOrientation);

    const orientation = quat.identity([]);
    quat.rotateX(orientation, orientation, -tr._pitch);
    quat.rotateZ(orientation, orientation, -tr.angle);
    const rotMat = mat4.fromQuat([], orientation);

    mat4.multiply(matrix, matrix, rotMat);
    mat4.multiply(matrix, matrix, globeMat);

    const atmosphereHeight = 0.025 * tr.worldSize / 2.0 / Math.PI;
    const cameraHeight = tr._camera.position[2] * tr.worldSize;
    const opacity = Math.min(cameraHeight / atmosphereHeight, 1.0);

    const uniforms = starsUniformValues(matrix, opacity * opacity);

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
        colorMode, CullFaceMode.disabled,
        uniforms, "stars", starsVb, starsIb, starsSegs);
}

function drawGlobeAtmosphere(painter: Painter) {

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);

    const program = painter.useProgram('globeAtmosphere');
    if (!atmosphereVb) {
        const vertices = new GlobeVertexArray();
        const triangles = new TriangleIndexArray();

        vertices.emplaceBack(-1.0, 1.0, 0.0, 0.0, 0.0);
        vertices.emplaceBack(1.0, 1.0, 0.0, 1.0, 0.0);
        vertices.emplaceBack(1.0, -1.0, 0.0, 1.0, 1.0);
        vertices.emplaceBack(-1.0, -1.0, 0.0, 0.0, 1.0);

        triangles.emplaceBack(0, 1, 2);
        triangles.emplaceBack(2, 3, 0);

        atmosphereVb = context.createVertexBuffer(vertices, layout.members);
        atmosphereIb = context.createIndexBuffer(triangles);
        atmosphereSegs = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    // Compute center and approximate radius of the globe on screen coordinates
    const globeMatrix = transform.calculateGlobeMatrix(transform.worldSize);
    const viewMatrix = transform._camera.getWorldToCamera(transform.worldSize, 1.0);
    const viewToProj = transform._camera.getCameraToClipPerspective(transform._fov, transform.width / transform.height, transform._nearZ, transform._farZ);
    const globeToView = mat4.mul([], viewMatrix, globeMatrix);
    const viewToScreen = mat4.mul([], transform.labelPlaneMatrix, viewToProj);

    const centerOnViewSpace = vec3.transformMat4([], [0,0,0], globeToView);
    const radiusOnViewSpace = vec3.add([], centerOnViewSpace, [transform.worldSize / Math.PI / 2.0, 0, 0]);

    const centerOnScreen = vec3.transformMat4([], centerOnViewSpace, viewToScreen);
    const radiusOnScreen = vec3.transformMat4([], radiusOnViewSpace, viewToScreen);

    const pixelRadius = vec3.length(vec3.sub([], radiusOnScreen, centerOnScreen));

    const globeCenter = [globeMatrix[12], globeMatrix[13], globeMatrix[14]];
    const cameraCenter = vec3.scale([], transform._camera.position, transform.worldSize);
    const cameraDir = transform._camera.forward();
    const frustum = Frustum.fromInvProjectionMatrix(transform.invProjMatrix, 1.0, 0.0);
    const p = frustum.points;
    // 4 = far tl, tr, br, bl

    let lightDir = vec3.normalize([], [-1, -1, -1]);
    //const invMatrix = mat4.invert([], globeMatrix);
    const invMatrix = globeMatrix;
    invMatrix[12] = 0;
    invMatrix[13] = 0;
    invMatrix[14] = 0;
    vec3.transformMat4(lightDir, lightDir, invMatrix);
    vec3.normalize(lightDir, lightDir);

    const uniforms = atmosphereUniformValues(
        centerOnScreen,
        pixelRadius,
        [transform.width, transform.height],
        browser.devicePixelRatio,
        1.0,                        // opacity
        0.5,                        // fadeout range
        [1.0, 1.0, 1.0],            // start color
        [0.0118, 0.7451, 0.9882],   // end color
        globeCenter,                // globe pos
        cameraCenter,               // camera pos
        cameraDir,                  // camera dir
        frustum.points[0],          // tl
        vec3.sub([],p[1], p[0]),    // right
        vec3.sub([],p[3], p[0]),
        transform.worldSize / 2.0 / Math.PI,
        lightDir);   // down
        
    painter.prepareDrawProgram(context, program);

    const ZERO = 0x0000;
    const ONE = 0x0001;
    const SRC_ALPHA = 0x0302;
    const ONE_MINUS_SRC_ALPHA = 0x0303;
    const CONSTANT_ALPHA = 0x8003;

    const colorMode = new ColorMode([ONE, SRC_ALPHA, ZERO, CONSTANT_ALPHA], Color.white, [true, true, true, true]);

    program.draw(context, gl.TRIANGLES, /*depthMode*/ DepthMode.disabled, StencilMode.disabled,
        colorMode, CullFaceMode.backCW,
        uniforms, "skybox", atmosphereVb, atmosphereIb, atmosphereSegs);
}

function drawSky(painter: Painter, sourceCache: SourceCache, layer: SkyLayer) {
    if (painter.transform.projection.name === 'globe') {
        drawStars(painter);
        drawGlobeAtmosphere(painter, layer);
    } else {
        const opacity = layer.paint.get('sky-opacity');
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
}

function drawSkyboxGradient(painter: Painter, layer: SkyLayer, depthMode: DepthMode, opacity: number, temporalOffset: number) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const program = painter.useProgram('skyboxGradient');

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

    painter.prepareDrawProgram(context, program);

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
        painter.colorModeForRenderPass(), CullFaceMode.backCW,
        uniformValues, 'skyboxGradient', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

let atmosphereVb = null;
let atmosphereIb = null;
let atmosphereSegs = null;

const layout = createLayout([
    { type: 'Float32', name: 'a_pos', components: 3 },
    { type: 'Float32', name: 'a_uv', components: 2 }
]);

function drawSkyboxFromCapture(painter: Painter, layer: SkyLayer, depthMode: DepthMode, opacity: number, temporalOffset: number) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const program = painter.useProgram('skybox');

    context.activeTexture.set(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, layer.skyboxTexture);

    const uniformValues = skyboxUniformValues(transform.skyboxMatrix, layer.getCenter(painter, false), 0, opacity, temporalOffset);

    painter.prepareDrawProgram(context, program);

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
        painter.colorModeForRenderPass(), CullFaceMode.backCW,
        uniformValues, 'skybox', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

function drawSkyboxFace(context: Context, layer: SkyLayer, program: Program<*>, faceRotate: mat4, sunDirection: vec3, i: number) {
    const gl = context.gl;

    const atmosphereColor = layer.paint.get('sky-atmosphere-color');
    const atmosphereHaloColor = layer.paint.get('sky-atmosphere-halo-color');
    const sunIntensity = layer.paint.get('sky-atmosphere-sun-intensity');

    const uniformValues = skyboxCaptureUniformValues(
        mat3.fromMat4([], faceRotate),
        sunDirection,
        sunIntensity,
        atmosphereColor,
        atmosphereHaloColor);

    const glFace = gl.TEXTURE_CUBE_MAP_POSITIVE_X + i;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, glFace, layer.skyboxTexture, 0);

    program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.frontCW,
        uniformValues, 'skyboxCapture', layer.skyboxGeometry.vertexBuffer,
        layer.skyboxGeometry.indexBuffer, layer.skyboxGeometry.segment);
}

function captureSkybox(painter: Painter, layer: SkyLayer, width: number, height: number) {
    const context = painter.context;
    const gl = context.gl;
    let fbo = layer.skyboxFbo;

    // Using absence of fbo as a signal for lazy initialization of all resources, cache resources in layer object
    if (!fbo) {
        fbo = layer.skyboxFbo = context.createFramebuffer(width, height, false);
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
    const program = painter.useProgram('skyboxCapture');
    const faceRotate = new Float64Array(16);

    // +x;
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, -Math.PI * 0.5);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 0);
    // -x
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, Math.PI * 0.5);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 1);
    // +y
    mat4.identity(faceRotate);
    mat4.rotateX(faceRotate, faceRotate, -Math.PI * 0.5);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 2);
    // -y
    mat4.identity(faceRotate);
    mat4.rotateX(faceRotate, faceRotate, Math.PI * 0.5);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 3);
    // +z
    mat4.identity(faceRotate);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 4);
    // -z
    mat4.identity(faceRotate);
    mat4.rotateY(faceRotate, faceRotate, Math.PI);
    drawSkyboxFace(context, layer, program, faceRotate, sunDirection, 5);

    context.viewport.set([0, 0, painter.width, painter.height]);
}
