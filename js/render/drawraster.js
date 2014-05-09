'use strict';

var Tile = require('../ui/tile.js');
module.exports = drawRaster;

function drawRaster(gl, painter, bucket, layerStyle) {

    var shader = painter.rasterShader;
    gl.switchShader(shader, painter.tile.posMatrix, painter.tile.exMatrix);

    gl.uniform1f(shader.u_brightness_low, layerStyle['raster-brightness-low'] || 0);
    gl.uniform1f(shader.u_brightness_high, layerStyle['raster-brightness-high'] || 1);
    gl.uniform1f(shader.u_saturation_factor, saturationFactor(layerStyle['raster-saturation'] || 0));
    gl.uniform1f(shader.u_contrast_factor, contrastFactor(layerStyle['raster-contrast'] || 0));
    gl.uniform3fv(shader.u_spin_weights, spinWeights(layerStyle['raster-spin'] || 0));

    var fadeDuration = 400;
    var now = new Date().getTime();

    var tile = bucket; // yeah this is weird
    var tilePos = Tile.fromID(tile.id);
    var sinceTile = (now - tile.timeAdded) / fadeDuration;

    var parentTile = findParent(tile);
    var parentPos = parentTile && Tile.fromID(parentTile.id);
    var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

    var idealZ = tile.source._coveringZoomLevel(tile.source._getZoom());
    var parentFurther = parentTile ? Math.abs(parentPos.z - idealZ) > Math.abs(tilePos.z - idealZ): false;

    var parentScaleBy = 1;
    var parentTL = [0, 0];
    if (parentTile) {
        parentScaleBy = Math.pow(2, parentPos.z - tilePos.z);
        parentTL = [tilePos.x * parentScaleBy % 1, tilePos.y * parentScaleBy % 1];
    }

    var opacity;
    if (!parentTile || parentFurther) {
        // if no parent or parent is older
        opacity = clamp(sinceTile, 0, 1);
    } else {
        // parent is younger, zooming out
        opacity = clamp(1 - sinceParent, 0, 1);
    }

    gl.activeTexture(gl.TEXTURE0);
    tile.bind(gl);

    gl.activeTexture(gl.TEXTURE1);
    if (parentTile) {
        parentTile.bind(gl);
    } else {
        tile.bind(gl);
    }


    gl.uniform2fv(shader.u_tl_parent, parentTL);
    gl.uniform1f(shader.u_scale_parent, parentScaleBy);
    gl.uniform1f(shader.u_mix, opacity);
    gl.uniform1i(shader.u_image0, 0);
    gl.uniform1i(shader.u_image1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);

    gl.vertexAttribPointer(
        shader.a_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);
}

function findParent(tile) {
    var source = tile.source;
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
