'use strict';

var TileCoord = require('../source/tile_coord');
var PrerenderedTexture = require('./prerendered');
var mat4 = require('gl-matrix').mat4;
var util = require('../util/util');

module.exports = drawRaster;

function drawRaster(painter, layer, posMatrix, tile) {
    var gl = painter.gl;
    var texture;

    if (layer.layers) {
        if (!tile.prerendered) {
            tile.prerendered = {};
        }

        texture = tile.prerendered[layer.id];

        if (!texture) {
            texture = tile.prerendered[layer.id] = new PrerenderedTexture(gl, layer.layout, painter);
            texture.bindFramebuffer();

            gl.clearStencil(0x80);
            gl.stencilMask(0xFF);
            gl.clear(gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
            gl.stencilMask(0x00);

            gl.viewport(0, 0, texture.size, texture.size);

            var buffer = texture.buffer * 4096;

            var matrix = mat4.create();
            mat4.ortho(matrix, -buffer, 4096 + buffer, -4096 - buffer, buffer, 0, 1);
            mat4.translate(matrix, matrix, [0, -4096, 0]);

            var padded = mat4.create();
            mat4.ortho(padded, 0, 4096, -4096, 0, 0, 1);
            mat4.translate(padded, padded, [0, -4096, 0]);

            painter.drawLayers(layer.layers, matrix, tile, {padded: padded});

            if (layer.layout['raster-blur'] > 0) {
                texture.blur(painter, layer.layout['raster-blur']);
            }

            texture.unbindFramebuffer();
            gl.viewport(0, 0, painter.width, painter.height);
        }
    } else {
        texture = tile;
    }

    gl.disable(gl.STENCIL_TEST);

    var shader = painter.rasterShader;
    gl.switchShader(shader, posMatrix);

    // color parameters
    gl.uniform1f(shader.u_brightness_low, layer.paint['raster-brightness'][0]);
    gl.uniform1f(shader.u_brightness_high, layer.paint['raster-brightness'][1]);
    gl.uniform1f(shader.u_saturation_factor, saturationFactor(layer.paint['raster-saturation']));
    gl.uniform1f(shader.u_contrast_factor, contrastFactor(layer.paint['raster-contrast']));
    gl.uniform3fv(shader.u_spin_weights, spinWeights(layer.paint['raster-hue-rotate']));

    var parentTile, opacities;
    if (layer.layers) {
        parentTile = null;
        opacities = [layer.paint['raster-opacity'], 0];
    } else {
        parentTile = texture.source && texture.source._pyramid.findLoadedParent(texture.id, 0, {});
        opacities = getOpacities(texture, parentTile, layer, painter.transform);
    }
    var parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture.texture);

    if (parentTile) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, parentTile.texture);

        var tilePos = TileCoord.fromID(texture.id);
        var parentPos = parentTile && TileCoord.fromID(parentTile.id);
        parentScaleBy = Math.pow(2, parentPos.z - tilePos.z);
        parentTL = [tilePos.x * parentScaleBy % 1, tilePos.y * parentScaleBy % 1];
    } else {
        opacities[1] = 0;
    }

    var bufferScale = layer.layers ? (4096 * (1 + 2 * texture.buffer)) / 4096 : 1;

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

function getOpacities(tile, parentTile, layer, transform) {
    if (!tile.source) return [1, 0];

    var now = new Date().getTime();

    var fadeDuration = layer.paint['raster-fade-duration'];
    var sinceTile = (now - tile.timeAdded) / fadeDuration;
    var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

    var tilePos = TileCoord.fromID(tile.id);
    var parentPos = parentTile && TileCoord.fromID(parentTile.id);

    var idealZ = tile.source._pyramid.coveringZoomLevel(transform);
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

    var op = layer.paint['raster-opacity'];
    opacity[0] *= op;
    opacity[1] *= op;

    return opacity;
}
