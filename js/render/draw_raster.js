'use strict';

var util = require('../util/util');
var StructArrayType = require('../util/struct_array');

module.exports = drawRaster;

function drawRaster(painter, sourceCache, layer, coords) {
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
        drawRasterTile(painter, sourceCache, layer, coord);
    }

    gl.depthFunc(gl.LEQUAL);
}

drawRaster.RasterBoundsArray = new StructArrayType({
    members: [
        { name: 'a_pos', type: 'Int16', components: 2 },
        { name: 'a_texture_pos', type: 'Int16', components: 2 }
    ]
});

function drawRasterTile(painter, sourceCache, layer, coord) {

    var gl = painter.gl;

    gl.disable(gl.STENCIL_TEST);

    var tile = sourceCache.getTile(coord);
    var posMatrix = painter.transform.calculatePosMatrix(coord, sourceCache.getSource().maxzoom);

    var program = painter.useProgram('raster');
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

    // color parameters
    gl.uniform1f(program.u_brightness_low, layer.paint['raster-brightness-min']);
    gl.uniform1f(program.u_brightness_high, layer.paint['raster-brightness-max']);
    gl.uniform1f(program.u_saturation_factor, saturationFactor(layer.paint['raster-saturation']));
    gl.uniform1f(program.u_contrast_factor, contrastFactor(layer.paint['raster-contrast']));
    gl.uniform3fv(program.u_spin_weights, spinWeights(layer.paint['raster-hue-rotate']));

    var parentTile = tile.sourceCache && tile.sourceCache.findLoadedParent(coord, 0, {}),
        opacities = getOpacities(tile, parentTile, layer, painter.transform);

    var parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);

    gl.activeTexture(gl.TEXTURE1);

    if (parentTile) {
        gl.bindTexture(gl.TEXTURE_2D, parentTile.texture);
        parentScaleBy = Math.pow(2, parentTile.coord.z - tile.coord.z);
        parentTL = [tile.coord.x * parentScaleBy % 1, tile.coord.y * parentScaleBy % 1];

    } else {
        gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    }

    // cross-fade parameters
    gl.uniform2fv(program.u_tl_parent, parentTL || [0, 0]);
    gl.uniform1f(program.u_scale_parent, parentScaleBy || 1);
    gl.uniform1f(program.u_buffer_scale, 1);
    gl.uniform1f(program.u_opacity0, opacities[0]);
    gl.uniform1f(program.u_opacity1, opacities[1]);
    gl.uniform1i(program.u_image0, 0);
    gl.uniform1i(program.u_image1, 1);

    var buffer = tile.boundsBuffer || painter.rasterBoundsBuffer;
    var vao = tile.boundsVAO || painter.rasterBoundsVAO;
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
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
    var opacities = [1, 0];
    var fadeDuration = layer.paint['raster-fade-duration'];

    if (tile.sourceCache && fadeDuration > 0) {
        var now = Date.now();
        var sinceTile = (now - tile.timeAdded) / fadeDuration;
        var sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        var source = tile.sourceCache.getSource();
        var idealZ = transform.coveringZoomLevel({
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });

        // if no parent or parent is older, fade in; if parent is younger, fade out
        var fadeIn = !parentTile || Math.abs(parentTile.coord.z - idealZ) > Math.abs(tile.coord.z - idealZ);

        opacities[0] = util.clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);
        opacities[1] = parentTile ? 1 - opacities[0] : 0;
    }

    var opacity = layer.paint['raster-opacity'];
    opacities[0] *= opacity;
    opacities[1] *= opacity;

    return opacities;
}
