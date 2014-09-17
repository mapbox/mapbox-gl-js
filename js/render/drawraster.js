'use strict';

var TileCoord = require('../source/tilecoord.js');
var PrerenderedTexture = require('./prerendered.js');
var mat4 = require('../lib/glmatrix.js').mat4;
var util = require('../util/util.js');

module.exports = drawRaster;

function drawRaster(gl, painter, bucket, layerStyle, params, style, layer, tile) {
    var texture;

    if (layer && layer.layers) {
        if (!bucket.prerendered) {
            bucket.prerendered = new PrerenderedTexture(gl, bucket.info, painter);
            bucket.prerendered.bindFramebuffer();

            gl.clearStencil(0x80);
            gl.stencilMask(0xFF);
            gl.clear(gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
            gl.stencilMask(0x00);

            gl.viewport(0, 0, bucket.prerendered.size, bucket.prerendered.size);

            var buffer = bucket.prerendered.buffer * 4096;

            var matrix = mat4.create();
            mat4.ortho(matrix, -buffer, 4096 + buffer, -4096 - buffer, buffer, 0, 1);
            mat4.translate(matrix, matrix, [0, -4096, 0]);

            params.padded = mat4.create();
            mat4.ortho(params.padded, 0, 4096, -4096, 0, 0, 1);
            mat4.translate(params.padded, params.padded, [0, -4096, 0]);

            painter.draw(tile, style, layer.layers, params, matrix);

            delete params.padded;

            if (bucket.info['raster-blur'] > 0) {
                bucket.prerendered.blur(painter, bucket.info['raster-blur']);
            }

            bucket.prerendered.unbindFramebuffer();
            gl.viewport(0, 0, painter.width, painter.height);
        }

        texture = bucket.prerendered;
    } else {
        texture = bucket.tile;
    }

    gl.disable(gl.STENCIL_TEST);

    var shader = painter.rasterShader;
    gl.switchShader(shader, painter.tile.posMatrix, painter.tile.exMatrix);

    // color parameters
    gl.uniform1f(shader.u_brightness_low, layerStyle['raster-brightness'][0]);
    gl.uniform1f(shader.u_brightness_high, layerStyle['raster-brightness'][1]);
    gl.uniform1f(shader.u_saturation_factor, saturationFactor(layerStyle['raster-saturation']));
    gl.uniform1f(shader.u_contrast_factor, contrastFactor(layerStyle['raster-contrast']));
    gl.uniform3fv(shader.u_spin_weights, spinWeights(layerStyle['raster-hue-rotate']));

    var parentTile, opacities;
    if (layer && layer.layers) {
        parentTile = null;
        opacities = [layerStyle['raster-opacity'], 0];
    } else {
        parentTile = texture.source && texture.source._findLoadedParent(texture.id, 0, {});
        opacities = getOpacities(texture, parentTile, layerStyle);
    }
    var parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    texture.bind(gl);

    if (parentTile) {
        gl.activeTexture(gl.TEXTURE1);
        parentTile.bind(gl);

        var tilePos = TileCoord.fromID(texture.id);
        var parentPos = parentTile && TileCoord.fromID(parentTile.id);
        parentScaleBy = Math.pow(2, parentPos.z - tilePos.z);
        parentTL = [tilePos.x * parentScaleBy % 1, tilePos.y * parentScaleBy % 1];
    } else {
        opacities[1] = 0;
    }

    var bufferScale = bucket.prerendered ? (4096 * (1 + 2 * bucket.prerendered.buffer)) / 4096 : 1;

    // cross-fade parameters
    gl.uniform2fv(shader.u_tl_parent, parentTL || [0, 0]);
    gl.uniform1f(shader.u_scale_parent, parentScaleBy || 1);
    gl.uniform1f(shader.u_buffer_scale, bufferScale);
    gl.uniform1f(shader.u_opacity0, opacities[0]);
    gl.uniform1f(shader.u_opacity1, opacities[1]);
    gl.uniform1i(shader.u_image0, 0);
    gl.uniform1i(shader.u_image1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, texture.boundsBuffer || painter.tileExtentBuffer);

    gl.vertexAttribPointer(shader.a_pos,         2, gl.SHORT, false, 8, 0);
    gl.vertexAttribPointer(shader.a_texture_pos, 2, gl.SHORT, false, 8, 4);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.STENCIL_TEST);
}

function spinWeights(angle) {
    angle *= Math.PI / 180;
    var s = Math.sin(angle);
    var c = Math.cos(angle);
    return [
        (2 * c + 1) / 3,
        (-Math.sqrt(3) * s - c + 1) / 3,
        (Math.sqrt(3) * s - c + 1) / 3
    ];
}

function contrastFactor(contrast) {
    return contrast > 0 ?
        1 / (1 - contrast) :
        1 + contrast;
}

function saturationFactor(saturation) {
    return saturation > 0 ?
        1 - 1 / (1.001 - saturation) :
        -saturation;
}

function getOpacities(tile, parentTile, layerStyle) {
    if (!tile.source) return [1, 0];

    var now = new Date().getTime();

    var fadeDuration = layerStyle['raster-fade-duration'];
    var sinceTile = (now - tile.timeAdded) / fadeDuration;
    var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

    var tilePos = TileCoord.fromID(tile.id);
    var parentPos = parentTile && TileCoord.fromID(parentTile.id);

    var idealZ = tile.source._coveringZoomLevel();
    var parentFurther = parentTile ? Math.abs(parentPos.z - idealZ) > Math.abs(tilePos.z - idealZ) : false;

    var opacity = [];
    if (!parentTile || parentFurther) {
        // if no parent or parent is older
        opacity[0] = util.clamp(sinceTile, 0, 1);
        opacity[1] = 1 - opacity[0];
    } else {
        // parent is younger, zooming out
        opacity[0] = util.clamp(1 - sinceParent, 0, 1);
        opacity[1] = 1 - opacity[0];
    }

    var op = layerStyle['raster-opacity'];
    opacity[0] *= op;
    opacity[1] *= op;

    return opacity;
}
