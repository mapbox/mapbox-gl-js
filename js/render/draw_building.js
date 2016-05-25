'use strict';

var util = require('../util/util');
var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;
var vec3 = require('gl-matrix').vec3;

module.exports = draw;

function draw(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        drawBuilding(painter, source, layer, coord);
    }

    if (!painter.isOpaquePass && layer.paint['building-antialias'] === true && !(layer.paint['building-image'] && !strokeColor)) {
        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];
            drawBuildingStroke(painter, source, layer, coord);
        }
    }

    gl.enable(gl.STENCIL_TEST);
}

function drawBuilding(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var bufferGroups = bucket.bufferGroups.building;
    if (!bufferGroups) return;

    if (painter.isOpaquePass) return;
    painter.setDepthSublayer(2);

    var gl = painter.gl;
    var program = painter.useProgram('building');

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['building-translate'] || [0,0],
        layer.paint['building-translate-anchor'] || 'viewport'
    ));

    var color = util.premultiply(layer.paint['building-color']);
    var shadowColor = util.premultiply(layer.paint['building-shadow-color'] || [0,0,1,1]);
    shadowColor[3] = 1;
    var image = layer.paint['building-pattern'];
    var opacity = layer.paint['building-opacity'] || 1;

    if (false && image) {

        // TODO

    } else {
        // Draw building rectangle.
        var zScale = Math.pow(2, painter.transform.zoom) / 50000;
        gl.uniformMatrix4fv(program.u_matrix, false, mat4.scale(
            mat4.create(),
            coord.posMatrix,
            [1, 1, zScale, 1])
        );

        gl.uniform4fv(program.u_color, color);
        gl.uniform4fv(program.u_shadow, shadowColor);

        var lightdir = [-0.5, -0.6, 0.9];
        var lightMat = mat3.create();
        mat3.rotate(lightMat, lightMat, -painter.transform.angle);
        vec3.transformMat3(lightdir, lightdir, lightMat);
        gl.uniform3fv(program.u_lightdir, lightdir);
    }

    for (var i = 0; i < bufferGroups.length; i++) {
        var group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element);
        gl.drawElements(gl.TRIANGLES, group.layout.element.length * 3, gl.UNSIGNED_SHORT, 0);
    }
}

function drawBuildingStroke(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;

    var gl = painter.gl;
    var bufferGroups = bucket.bufferGroups.building;

    painter.setDepthSublayer(1);
    painter.lineWidth(2);

    var strokeColor = layer.paint['building-outline-color'];

    var image = layer.paint['building-pattern'];
    var opacity = layer.paint['building-opacity'];
    var program = image ? painter.useProgram('outlinepattern') : painter.useProgram('outline');

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['building-translate'],
        layer.paint['building-translate-anchor']
    ));

    if (false && image) {
        // TODO
        setPattern(image, opacity, tile, coord, painter, program);
    } else {
        gl.uniform4fv(program.u_color, util.premultiply(strokeColor || [0,0,0,1]));
    }

    painter.enableTileClippingMask(coord);

    for (var k = 0; k < bufferGroups.length; k++) {
        var group = bufferGroups[k];
        group.secondVaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element2);
        gl.drawElements(gl.LINES, group.layout.element2.length * 2, gl.UNSIGNED_SHORT, 0);
    }
}

function setPattern(image, opacity, tile, coord, painter, program) {
    var gl = painter.gl;

    var imagePosA = painter.spriteAtlas.getPosition(image.from, true);
    var imagePosB = painter.spriteAtlas.getPosition(image.to, true);
    if (!imagePosA || !imagePosB) return;

    gl.uniform1i(program.u_image, 0);
    gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
    gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
    gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
    gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
    gl.uniform1f(program.u_opacity, opacity);
    gl.uniform1f(program.u_mix, image.t);

    gl.uniform1f(program.u_tile_units_to_pixels, 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom));
    gl.uniform2fv(program.u_pattern_size_a, imagePosA.size);
    gl.uniform2fv(program.u_pattern_size_b, imagePosB.size);
    gl.uniform1f(program.u_scale_a, image.fromScale);
    gl.uniform1f(program.u_scale_b, image.toScale);

    var tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom - tile.coord.z);

    var pixelX = tileSizeAtNearestZoom * (tile.coord.x + coord.w * Math.pow(2, tile.coord.z));
    var pixelY = tileSizeAtNearestZoom * tile.coord.y;
    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    gl.uniform2f(program.u_pixel_coord_upper, pixelX >> 16, pixelY >> 16);
    gl.uniform2f(program.u_pixel_coord_lower, pixelX & 0xFFFF, pixelY & 0xFFFF);

    gl.activeTexture(gl.TEXTURE0);
    painter.spriteAtlas.bind(gl, true);
}
