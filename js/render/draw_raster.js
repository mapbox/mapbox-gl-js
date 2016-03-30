'use strict';

var util = require('../util/util');

module.exports = drawRaster;

function drawRaster(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;

    var gl = painter.gl;

    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(true);

    // Change depth function to prevent double drawing in areas where tiles overlap.
    gl.depthFunc(gl.LESS);

    var minTileZ = coords.length && coords[0].z;

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        // set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        painter.setDepthSublayer(coord.z - minTileZ);
        drawRasterTile(painter, source, layer, coord);
    }

    gl.depthFunc(gl.LEQUAL);
}

function drawRasterTile(painter, source, layer, coord) {

    var gl = painter.gl;

    gl.disable(gl.STENCIL_TEST);

    var tile = source.getTile(coord);
    var posMatrix = painter.transform.calculatePosMatrix(coord, source.maxzoom);

    var program = painter.useProgram('raster');
    painter.setPosMatrix(posMatrix);

    // color parameters
    gl.uniform1f(program.u_brightness_low, layer.paint['raster-brightness-min']);
    gl.uniform1f(program.u_brightness_high, layer.paint['raster-brightness-max']);
    gl.uniform1f(program.u_saturation_factor, saturationFactor(layer.paint['raster-saturation']));
    gl.uniform1f(program.u_contrast_factor, contrastFactor(layer.paint['raster-contrast']));
    gl.uniform3fv(program.u_spin_weights, spinWeights(layer.paint['raster-hue-rotate']));

    var parentTile = tile.source && tile.source._pyramid.findLoadedParent(coord, 0, {}),
        opacities = getOpacities(tile, parentTile, layer, painter.transform);

    var parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);

    if (parentTile) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, parentTile.texture);

        parentScaleBy = Math.pow(2, parentTile.coord.z - tile.coord.z);
        parentTL = [tile.coord.x * parentScaleBy % 1, tile.coord.y * parentScaleBy % 1];
    } else {
        opacities[1] = 0;
    }

    // cross-fade parameters
    gl.uniform2fv(program.u_tl_parent, parentTL || [0, 0]);
    gl.uniform1f(program.u_scale_parent, parentScaleBy || 1);
    gl.uniform1f(program.u_buffer_scale, 1);
    gl.uniform1f(program.u_opacity0, opacities[0]);
    gl.uniform1f(program.u_opacity1, opacities[1]);
    gl.uniform1i(program.u_image0, 0);
    gl.uniform1i(program.u_image1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, tile.boundsBuffer || painter.tileExtentBuffer);

    gl.vertexAttribPointer(program.a_pos,         2, gl.SHORT, false, 8, 0);
    gl.vertexAttribPointer(program.a_texture_pos, 2, gl.SHORT, false, 8, 4);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    var opacity = [1, 0];
    var fadeDuration = layer.paint['raster-fade-duration'];

    if (tile.source && fadeDuration > 0) {
        var now = new Date().getTime();

        var sinceTile = (now - tile.timeAdded) / fadeDuration;
        var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        var idealZ = tile.source._pyramid.coveringZoomLevel(transform);
        var parentFurther = parentTile ? Math.abs(parentTile.coord.z - idealZ) > Math.abs(tile.coord.z - idealZ) : false;

        if (!parentTile || parentFurther) {
            // if no parent or parent is older
            opacity[0] = util.clamp(sinceTile, 0, 1);
            opacity[1] = 1 - opacity[0];
        } else {
            // parent is younger, zooming out
            opacity[0] = util.clamp(1 - sinceParent, 0, 1);
            opacity[1] = 1 - opacity[0];
        }
    }

    var op = layer.paint['raster-opacity'];
    opacity[0] *= op;
    opacity[1] *= op;

    return opacity;
}
