// @flow

const glMatrix = require('@mapbox/gl-matrix');
const pattern = require('./pattern');
const mat3 = glMatrix.mat3;
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = draw;

function draw(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<TileCoord>) {
    if (layer.paint.get('fill-extrusion-opacity') === 0) {
        return;
    }

    if (painter.renderPass === '3d') {
        const gl = painter.gl;

        gl.disable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);

        painter.clearColor();
        painter.depthMask(true);

        for (let i = 0; i < coords.length; i++) {
            drawExtrusion(painter, source, layer, coords[i]);
        }
    } else if (painter.renderPass === 'translucent') {
        drawExtrusionTexture(painter, layer);
    }
}

function drawExtrusionTexture(painter, layer) {
    const renderedTexture = layer.viewportFrame;
    if (!renderedTexture) return;

    const gl = painter.gl;
    const program = painter.useProgram('extrusionTexture');

    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderedTexture.texture);

    gl.uniform1f(program.uniforms.u_opacity, layer.paint.get('fill-extrusion-opacity'));
    gl.uniform1i(program.uniforms.u_image, 0);

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

    gl.uniform2f(program.uniforms.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    painter.viewportVAO.bind(gl, program, painter.viewportBuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function drawExtrusion(painter, source, layer, coord) {
    const tile = source.getTile(coord);
    const bucket: ?FillExtrusionBucket = (tile.getBucket(layer): any);
    if (!bucket) return;

    const gl = painter.gl;

    const image = layer.paint.get('fill-extrusion-pattern');

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);
    programConfiguration.setUniforms(gl, program, layer.paint, {zoom: painter.transform.zoom});

    if (image) {
        if (pattern.isPatternMissing(image, painter)) return;
        pattern.prepare(image, painter, program);
        pattern.setTile(tile, painter, program);
        gl.uniform1f(program.uniforms.u_height_factor, -Math.pow(2, coord.z) / tile.tileSize / 8);
    }

    painter.gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint.get('fill-extrusion-translate'),
        layer.paint.get('fill-extrusion-translate-anchor')
    ));

    setLight(program, painter);

    program.draw(
        gl,
        gl.TRIANGLES,
        layer.id,
        bucket.layoutVertexBuffer,
        bucket.indexBuffer,
        bucket.segments,
        programConfiguration);
}

function setLight(program, painter) {
    const gl = painter.gl;
    const light = painter.style.light;

    const _lp = light.properties.get('position');
    const lightPos = [_lp.x, _lp.y, _lp.z];

    const lightMat = mat3.create();
    if (light.properties.get('anchor') === 'viewport') {
        mat3.fromRotation(lightMat, -painter.transform.angle);
    }
    vec3.transformMat3(lightPos, lightPos, lightMat);

    const color = light.properties.get('color');

    gl.uniform3fv(program.uniforms.u_lightpos, lightPos);
    gl.uniform1f(program.uniforms.u_lightintensity, light.properties.get('intensity'));
    gl.uniform3f(program.uniforms.u_lightcolor, color.r, color.g, color.b);
}
