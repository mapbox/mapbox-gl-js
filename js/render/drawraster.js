'use strict';

var Tile = require('../ui/tile.js');
module.exports = drawRaster;

function drawRaster(gl, painter, tile, layerStyle) {

    gl.disable(gl.STENCIL_TEST);

    var shader = painter.rasterShader;
    gl.switchShader(shader, painter.tile.posMatrix, painter.tile.exMatrix);

    // color parameters
    gl.uniform1f(shader.u_brightness_low, layerStyle['raster-brightness-low']);
    gl.uniform1f(shader.u_brightness_high, layerStyle['raster-brightness-high']);
    gl.uniform1f(shader.u_saturation_factor, saturationFactor(layerStyle['raster-saturation']));
    gl.uniform1f(shader.u_contrast_factor, contrastFactor(layerStyle['raster-contrast']));
    gl.uniform3fv(shader.u_spin_weights, spinWeights(layerStyle['raster-spin']));


    var parentTile = findParent(tile);
    var opacities = getOpacities(tile, parentTile);
    var parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    tile.bind(gl);

    if (parentTile) {
        gl.activeTexture(gl.TEXTURE1);
        parentTile.bind(gl);

        var tilePos = Tile.fromID(tile.id);
        var parentPos = parentTile && Tile.fromID(parentTile.id);
        parentScaleBy = Math.pow(2, parentPos.z - tilePos.z);
        parentTL = [tilePos.x * parentScaleBy % 1, tilePos.y * parentScaleBy % 1];
    } else {
        opacities[1] = 0;
    }

    // cross-fade parameters
    gl.uniform2fv(shader.u_tl_parent, parentTL || [0, 0]);
    gl.uniform1f(shader.u_scale_parent, parentScaleBy || 1);
    gl.uniform1f(shader.u_opacity0, opacities[0]);
    gl.uniform1f(shader.u_opacity1, opacities[1]);
    gl.uniform1i(shader.u_image0, 0);
    gl.uniform1i(shader.u_image1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, tile.boundsBuffer || painter.tileExtentBuffer);

    gl.vertexAttribPointer(
        shader.a_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 8, 0);
    gl.vertexAttribPointer(
        shader.a_texture_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 8, 4);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);

    gl.enable(gl.STENCIL_TEST);
}

function findParent(tile) {
    var source = tile.source;
    if (!source) return;
    var parentTiles = {};
    source._findLoadedParent(tile.id, source.minTileZoom, parentTiles);
    return source.tiles[Object.keys(parentTiles)[0]];
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function spinWeights(spin) {
    var angle = spin * Math.PI;
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

function getOpacities(tile, parentTile) {
    if (!tile.source) return [1, 0];

    var now = new Date().getTime();
    var fadeDuration = tile.source.map.style.rasterFadeDuration;

    var sinceTile = (now - tile.timeAdded) / fadeDuration;
    var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

    var tilePos = Tile.fromID(tile.id);
    var parentPos = parentTile && Tile.fromID(parentTile.id);

    var idealZ = tile.source._coveringZoomLevel(tile.source._getZoom());
    var parentFurther = parentTile ? Math.abs(parentPos.z - idealZ) > Math.abs(tilePos.z - idealZ) : false;

    var opacity = [];
    if (!parentTile || parentFurther) {
        // if no parent or parent is older
        opacity[0] = clamp(sinceTile, 0, 1);
        opacity[1] = 1 - opacity[0];
    } else {
        // parent is younger, zooming out
        opacity[0] = clamp(1 - sinceParent, 0, 1);
        opacity[1] = 1 - opacity[0];
    }

    return opacity;
}
