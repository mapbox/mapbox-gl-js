// @flow

import { mat3, vec3 } from 'gl-matrix';

import {
    isPatternMissing,
    setPatternUniforms,
    prepare as preparePattern
} from './pattern';
import {drawToOffscreenFramebuffer, drawOffscreenTexture} from './offscreen';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default draw;

function draw(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>) {
    if (layer.paint.get('fill-extrusion-opacity') === 0) {
        return;
    }

    if (painter.renderPass === 'offscreen') {
        drawToOffscreenFramebuffer(painter, layer);

        let first = true;
        for (const coord of coords) {
            const tile = source.getTile(coord);
            const bucket: ?FillExtrusionBucket = (tile.getBucket(layer): any);
            if (!bucket) continue;

            drawExtrusion(painter, source, layer, tile, coord, bucket, first);
            first = false;
        }
    } else if (painter.renderPass === 'translucent') {
        drawOffscreenTexture(painter, layer, layer.paint.get('fill-extrusion-opacity'));
    }
}

function drawExtrusion(painter, source, layer, tile, coord, bucket, first) {
    const context = painter.context;
    const gl = context.gl;

    const image = layer.paint.get('fill-extrusion-pattern');

    const prevProgram = painter.context.program.get();
    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);
    if (first || program.program !== prevProgram) {
        programConfiguration.setUniforms(context, program, layer.paint, {zoom: painter.transform.zoom});
    }

    if (image) {
        if (isPatternMissing(image, painter)) return;
        preparePattern(image, painter, program);
        setPatternUniforms(tile, painter, program);
        gl.uniform1f(program.uniforms.u_height_factor, -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8);
    }

    painter.context.gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint.get('fill-extrusion-translate'),
        layer.paint.get('fill-extrusion-translate-anchor')
    ));

    setLight(program, painter);

    program.draw(
        context,
        gl.TRIANGLES,
        layer.id,
        bucket.layoutVertexBuffer,
        bucket.indexBuffer,
        bucket.segments,
        programConfiguration);
}

function setLight(program, painter) {
    const gl = painter.context.gl;
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
