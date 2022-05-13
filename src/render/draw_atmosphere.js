// @flow

import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {
    globeToMercatorTransition,
    globeUseCustomAntiAliasing
} from './../geo/projection/globe_util.js';
import {atmosphereUniformValues} from '../terrain/globe_raster_program.js';
import type Painter from './painter.js';
import type {DynamicDefinesType} from '../render/program/program_uniforms.js';
import {degToRad, mapValue} from '../util/util.js';
import {vec3, mat4, quat} from 'gl-matrix';
import Fog from '../style/fog.js';

export default drawAtmosphere;

function drawAtmosphere(painter: Painter, fog: Fog) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const defines = tr.projection.name === 'globe' ? ['PROJECTION_GLOBE_VIEW', 'FOG'] : ['FOG'];
    const program = painter.useProgram('globeAtmosphere', null, ((defines: any): DynamicDefinesType[]));

    const transitionT = globeToMercatorTransition(tr.zoom);

    const fogColor = fog.properties.get('color').toArray01();
    const highColor = fog.properties.get('high-color').toArray01();
    const spaceColor = fog.properties.get('space-color').toArray01PremultipliedAlpha();

    const orientation = quat.identity([]);

    quat.rotateY(orientation, orientation, -degToRad(tr._center.lng));
    quat.rotateX(orientation, orientation, degToRad(tr._center.lat));

    quat.rotateZ(orientation, orientation, tr.angle);
    quat.rotateX(orientation, orientation, -tr._pitch);

    const rotationMatrix = mat4.fromQuat(new Float32Array(16), orientation);

    const starIntensity = mapValue(fog.properties.get('star-intensity'), 0.0, 1.0, 0.0, 0.25);
    // https://www.desmos.com/calculator/oanvvpr36d
    // Ensure horizon blend is 0-exclusive to prevent division by 0 in the shader
    const minHorizonBlend = 0.0005;
    const horizonBlend = mapValue(fog.properties.get('horizon-blend'), 0.0, 1.0, minHorizonBlend, 0.25);

    // Use a slightly smaller size of the globe to account for custom
    // antialiasing that reduces the size of the globe of two pixels
    // https://www.desmos.com/calculator/xpgmzghc37
    const globeRadius = globeUseCustomAntiAliasing(painter, context, tr) && horizonBlend === minHorizonBlend ?
        tr.worldSize / (2.0 * Math.PI * 1.025) - 1.0 : tr.globeRadius;

    const temporalOffset = (painter.frameCounter / 1000.0) % 1;
    const globeCenterInViewSpace = (((tr.globeCenterInViewSpace): any): Array<number>);
    const globeCenterDistance = vec3.length(globeCenterInViewSpace);
    const distanceToHorizon = Math.sqrt(Math.pow(globeCenterDistance, 2.0) - Math.pow(globeRadius, 2.0));
    const horizonAngle = Math.acos(distanceToHorizon / globeCenterDistance);

    const uniforms = atmosphereUniformValues(
        tr.frustumCorners.TL,
        tr.frustumCorners.TR,
        tr.frustumCorners.BR,
        tr.frustumCorners.BL,
        tr.frustumCorners.horizon,
        transitionT,
        horizonBlend,
        fogColor,
        highColor,
        spaceColor,
        starIntensity,
        temporalOffset,
        horizonAngle,
        rotationMatrix);

    painter.prepareDrawProgram(context, program);

    const buffer = painter.atmosphereBuffer;
    if (buffer) {
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled,
            ColorMode.alphaBlended, CullFaceMode.backCW, uniforms, "skybox",
            buffer.vertexBuffer, buffer.indexBuffer, buffer.segments);
    }
}
