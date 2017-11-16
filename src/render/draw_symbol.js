// @flow

const drawCollisionDebug = require('./draw_collision_debug');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const symbolProjection = require('../symbol/projection');
const symbolSize = require('../symbol/symbol_size');
const mat4 = require('@mapbox/gl-matrix').mat4;
const identityMat4 = mat4.identity(new Float32Array(16));
const symbolLayoutProperties = require('../style/style_layer/symbol_style_layer_properties').layout;

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = drawSymbols;

function drawSymbols(painter: Painter, sourceCache: SourceCache, layer: SymbolStyleLayer, coords: Array<TileCoord>) {
    if (painter.renderPass !== 'translucent') return;

    const gl = painter.gl;

    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    gl.disable(gl.STENCIL_TEST);

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    if (layer.paint.get('icon-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, false,
            layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'),
            layer.layout.get('icon-rotation-alignment'),
            layer.layout.get('icon-pitch-alignment'),
            layer.layout.get('icon-keep-upright')
        );
    }

    if (layer.paint.get('text-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, true,
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.layout.get('text-keep-upright')
        );
    }

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords);
    }
}

function drawLayerSymbols(painter, sourceCache, layer, coords, isText, translate, translateAnchor,
    rotationAlignment, pitchAlignment, keepUpright) {

    const gl = painter.gl;
    const tr = painter.transform;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotateWithMap && layer.layout.get('symbol-placement') === 'line';
    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

    const depthOn = pitchWithMap;

    if (depthOn) {
        gl.enable(gl.DEPTH_TEST);
    } else {
        gl.disable(gl.DEPTH_TEST);
    }

    let program;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        const buffers = isText ? bucket.text : bucket.icon;
        if (!buffers || !buffers.segments.get().length) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;

        if (!program) {
            program = painter.useProgram(isSDF ? 'symbolSDF' : 'symbolIcon', programConfiguration);
            programConfiguration.setUniforms(gl, program, layer.paint, {zoom: painter.transform.zoom});

            setSymbolDrawState(program, painter, layer, isText, rotateInShader, pitchWithMap, sizeData);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.u_texture, 0);

        if (isText) {
            tile.glyphAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.uniform2fv(program.uniforms.u_texsize, tile.glyphAtlasTexture.size);
        } else {
            const iconScaled = layer.layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
            const iconTransformed = pitchWithMap || tr.pitch !== 0;

            tile.iconAtlasTexture.bind(isSDF || painter.options.rotating || painter.options.zooming || iconScaled || iconTransformed ?
                gl.LINEAR : gl.NEAREST, gl.CLAMP_TO_EDGE);
            gl.uniform2fv(program.uniforms.u_texsize, tile.iconAtlasTexture.size);
        }

        painter.enableTileClippingMask(coord);

        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor));

        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        const glCoordMatrix = symbolProjection.getGlCoordMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        gl.uniformMatrix4fv(program.uniforms.u_gl_coord_matrix, false, painter.translatePosMatrix(glCoordMatrix, tile, translate, translateAnchor, true));

        if (alongLine) {
            gl.uniformMatrix4fv(program.uniforms.u_label_plane_matrix, false, identityMat4);
            symbolProjection.updateLineLabels(bucket, coord.posMatrix, painter, isText, labelPlaneMatrix, glCoordMatrix, pitchWithMap, keepUpright);
        } else {
            gl.uniformMatrix4fv(program.uniforms.u_label_plane_matrix, false, labelPlaneMatrix);
        }

        gl.uniform1f(program.uniforms.u_fade_change, painter.options.collisionFadeDuration ? ((Date.now() - bucket.fadeStartTime) / painter.options.collisionFadeDuration) : 1);

        drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF, pitchWithMap);
    }

    if (!depthOn) gl.enable(gl.DEPTH_TEST);
}

function setSymbolDrawState(program, painter, layer, isText, rotateInShader, pitchWithMap, sizeData) {

    const gl = painter.gl;
    const tr = painter.transform;

    gl.uniform1i(program.uniforms.u_pitch_with_map, pitchWithMap ? 1 : 0);

    gl.uniform1f(program.uniforms.u_is_text, isText ? 1 : 0);

    gl.uniform1f(program.uniforms.u_pitch, tr.pitch / 360 * 2 * Math.PI);

    const isZoomConstant = sizeData.functionType === 'constant' || sizeData.functionType === 'source';
    const isFeatureConstant = sizeData.functionType === 'constant' || sizeData.functionType === 'camera';
    gl.uniform1i(program.uniforms.u_is_size_zoom_constant, isZoomConstant ? 1 : 0);
    gl.uniform1i(program.uniforms.u_is_size_feature_constant, isFeatureConstant ? 1 : 0);

    gl.uniform1f(program.uniforms.u_camera_to_center_distance, tr.cameraToCenterDistance);

    const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom, symbolLayoutProperties.properties[isText ? 'text-size' : 'icon-size']);
    if (size.uSizeT !== undefined) gl.uniform1f(program.uniforms.u_size_t, size.uSizeT);
    if (size.uSize !== undefined) gl.uniform1f(program.uniforms.u_size, size.uSize);

    gl.uniform1f(program.uniforms.u_aspect_ratio, tr.width / tr.height);
    gl.uniform1i(program.uniforms.u_rotate_symbol, rotateInShader ? 1 : 0);
}

function drawTileSymbols(program, programConfiguration, painter, layer, tile, buffers, isText, isSDF, pitchWithMap) {

    const gl = painter.gl;
    const tr = painter.transform;

    if (isSDF) {
        const hasHalo = layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;
        const gammaScale = (pitchWithMap ? Math.cos(tr._pitch) * tr.cameraToCenterDistance : 1);
        gl.uniform1f(program.uniforms.u_gamma_scale, gammaScale);

        if (hasHalo) { // Draw halo underneath the text.
            gl.uniform1f(program.uniforms.u_is_halo, 1);
            drawSymbolElements(buffers, layer, gl, program);
        }

        gl.uniform1f(program.uniforms.u_is_halo, 0);
    }

    drawSymbolElements(buffers, layer, gl, program);
}

function drawSymbolElements(buffers, layer, gl, program) {
    program.draw(
        gl,
        gl.TRIANGLES,
        layer.id,
        buffers.layoutVertexBuffer,
        buffers.indexBuffer,
        buffers.segments,
        buffers.programConfigurations.get(layer.id),
        buffers.dynamicLayoutVertexBuffer,
        buffers.opacityVertexBuffer);
}
