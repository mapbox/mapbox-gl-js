'use strict';

var util = require('../util/util');
var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;
var vec3 = require('gl-matrix').vec3;
var pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = draw;

function draw(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        drawExtrusion(painter, source, layer, coord);
    }

    if (!painter.isOpaquePass && layer.paint['extrusion-antialias'] === true && !(layer.paint['extrusion-image'] && !layer.paint['extrusion-outline-color'])) {
        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];
            drawExtrusionStroke(painter, source, layer, coord);
        }
    }

    gl.enable(gl.STENCIL_TEST);
}

function drawExtrusion(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var bufferGroups = bucket.bufferGroups.extrusion;
    if (!bufferGroups) return;

    if (painter.isOpaquePass) return;
    painter.setDepthSublayer(2);

    var gl = painter.gl;
    var program = painter.useProgram('extrusion');

    var color = util.premultiply(layer.paint['extrusion-color']);
    var shadowColor = util.premultiply(layer.paint['extrusion-shadow-color'] || [0,0,1,1]);
    shadowColor[3] = 1;
    var image = layer.paint['extrusion-pattern'];
    var opacity = layer.paint['extrusion-opacity'] || 1;
    var rotateLight = layer.paint['extrusion-lighting-anchor'] === 'viewport';

    if (image) {
        program = painter.useProgram('pattern');
        setPattern(image, opacity, tile, coord, painter, program);

        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);
    } else {
        // Draw extrusion rectangle.
        var zScale = Math.pow(2, painter.transform.zoom) / 50000;
        gl.uniformMatrix4fv(program.u_matrix, false, mat4.scale(
            mat4.create(),
            coord.posMatrix,
            [1, 1, zScale, 1])
        );

        gl.uniform4fv(program.u_color, color);
        gl.uniform4fv(program.u_shadow, shadowColor);
        gl.uniform1f(program.u_opacity, opacity);

        var lightdir = [-0.5, -0.6, 0.9];
        // NOTES FOR MYSELF
        // z: 0 is the minimum z; it clamps here. But
        //    0.5 is the first one that makes sense after 0.0 --
        //    in between are kind of ambient, but the first time
        //    the roof becomes as light as the top of the wall is 0.5
        //    The upper clamp is between 1.7 and 1.8
        // x:

        var lightMat = mat3.create();
        if (rotateLight) mat3.fromRotation(lightMat, -painter.transform.angle);
        vec3.transformMat3(lightdir, lightdir, lightMat);
        gl.uniform3fv(program.u_lightdir, lightdir);
    }

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['extrusion-translate'] || [0,0],
        layer.paint['extrusion-translate-anchor'] || 'viewport'
    ));

    for (var i = 0; i < bufferGroups.length; i++) {
        var group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layout.vertex, group.layout.element);
        gl.drawElements(gl.TRIANGLES, group.layout.element.length * 3, gl.UNSIGNED_SHORT, 0);
    }
}

function drawExtrusionStroke(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;

    var gl = painter.gl;
    var bufferGroups = bucket.bufferGroups.extrusion;

    painter.setDepthSublayer(1);
    painter.lineWidth(2);

    var strokeColor = layer.paint['extrusion-outline-color'];

    var image = layer.paint['extrusion-pattern'];
    var opacity = layer.paint['extrusion-opacity'];
    var program = image ? painter.useProgram('outlinepattern') : painter.useProgram('outline');

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['extrusion-translate'],
        layer.paint['extrusion-translate-anchor']
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
