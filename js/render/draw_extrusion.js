'use strict';

var util = require('../util/util');
var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;
var vec3 = require('gl-matrix').vec3;
var pixelsToTileUnits = require('../source/pixels_to_tile_units');
var Buffer = require('../data/buffer');
var VertexArrayObject = require('./vertex_array_object');
var RasterBoundsArray = require('../render/draw_raster').RasterBoundsArray;

module.exports = draw;

function draw(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);

    if (true) {
        painter.depthMask(true);

        var texture = new PrerenderedExtrusionLayer(gl, painter);
        texture.bindFramebuffer();

        gl.clearStencil(0x80);
        gl.stencilMask(0xFF);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.stencilMask(0x00);

        // DRAW
        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];
            drawExtrusion(painter, source, layer, coord);
        }

        if (!painter.isOpaquePass && layer.paint['extrusion-antialias']) {
            for (var i = 0; i < coords.length; i++) {
                var coord = coords[i];
                // TODO this is majorly broken -- causes only 1 rendered tile at a time
                // drawExtrusionStroke(painter, source, layer, coord);
            }
        }


        texture.unbindFramebuffer();

        var program = painter.useProgram('extrusiontexture');

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        gl.uniform1f(program.u_opacity, 0.85);
        gl.uniform1i(program.u_texture, 1);
        var zScale = Math.pow(2, painter.transform.zoom) / 50000;

        gl.uniformMatrix4fv(program.u_matrix, false, mat4.ortho(
            mat4.create(),
            0,
            painter.width,
            painter.height,
            0,
            0,
            1)
        );

        gl.disable(gl.DEPTH_TEST);

        gl.uniform1i(program.u_xdim, painter.width);
        gl.uniform1i(program.u_ydim, painter.height);

        var maxInt16 = 32767;
        var array = new RasterBoundsArray();
        // TODO I don't think i need the second attribute here (0/maxInt16)...
        array.emplaceBack(0, 0, 0, 0);
        array.emplaceBack(painter.width, 0, maxInt16, 0);
        array.emplaceBack(0, painter.height, maxInt16, maxInt16);
        array.emplaceBack(painter.width, painter.height, 0, maxInt16);
        var buffer = new Buffer(array.serialize(), RasterBoundsArray.serialize(), Buffer.BufferType.VERTEX);

        var vao = new VertexArrayObject();
        vao.bind(gl, program, buffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    else {


        for (var i = 0; i < coords.length; i++) {
            var coord = coords[i];
            drawExtrusion(painter, source, layer, coord);
        }

        if (!painter.isOpaquePass && layer.paint['extrusion-antialias']) {
            for (var i = 0; i < coords.length; i++) {
                var coord = coords[i];
                drawExtrusionStroke(painter, source, layer, coord);
            }
        }


    }

    gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.STENCIL_TEST);
}

function PrerenderedExtrusionLayer(gl, painter) {
    this.gl = gl;
    // this.buffer = 1/32;
    this.width = painter.width;
    this.height = painter.height;
    this.painter = painter;

    this.texture = null;
    this.fbo = null;
    this.fbos = this.painter.preFbos[this.width];
}

PrerenderedExtrusionLayer.prototype.bindFramebuffer = function() {
    var gl = this.gl;

    this.texture = this.painter.getTexture(this.width);

    gl.activeTexture(gl.TEXTURE1);

    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.texture.width = this.width;
        this.texture.height = this.height;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    if (!this.fbos) {
        this.fbo = gl.createFramebuffer();
        var stencil = gl.createRenderbuffer();
        var depthRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, this.width, this.height);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, stencil);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    } else {
        this.fbo = this.fbos.pop();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    }
}

PrerenderedExtrusionLayer.prototype.unbindFramebuffer = function() {
    this.painter.bindDefaultFramebuffer();
    if (this.fbos) {
        this.fbos.push(this.fbo);
    } else {
        this.painter.preFbos[this.width] = [this.fbo];
    }
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
    gl.enable(gl.DEPTH_TEST);
    var program = painter.useProgram('extrusion');

    // console.log(gl.getParameter(gl.ACTIVE_TEXTURE))

    var color = util.premultiply(layer.paint['extrusion-color']);
    var shadowColor = util.premultiply(layer.paint['extrusion-shadow-color'] || [0,0,1,1]);
    shadowColor[3] = 1;
    var image = layer.paint['extrusion-pattern'];
    var opacity = layer.paint['extrusion-opacity'] || 1;
    var rotateLight = layer.paint['extrusion-lighting-anchor'] === 'viewport';
    // TODO this should be changed to a map property probably so as not to get trippy situations where layers are lit differently...?

    if (image) {
        program = painter.useProgram('extrusionpattern');

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['extrusion-translate'] || [0,0],
            layer.paint['extrusion-translate-anchor'] || 'viewport'
        ));

        setPattern(image, opacity, tile, coord, painter, program);

        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);
    } else {
        // TODO I'm essentially copying all of this piecemeal for pattern; refactor later

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['extrusion-translate'] || [0,0],
            layer.paint['extrusion-translate-anchor'] || 'viewport'
        ));

        // Draw extrusion rectangle.
        var zScale = Math.pow(2, painter.transform.zoom) / 50000;
        gl.uniformMatrix4fv(program.u_matrix, false, mat4.scale(
            mat4.create(),
            coord.posMatrix,
            [1, 1, zScale, 1])
        );

        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_opacity, 1);
    }

    gl.uniform4fv(program.u_shadow, shadowColor);

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

    var strokeColor = layer.paint['extrusion-outline-color'] || layer.paint['extrusion-color'].slice();

    var image = layer.paint['extrusion-pattern'];
    var opacity = layer.paint['extrusion-opacity'];
    var outlineProgram = image ? painter.useProgram('outlinepattern') : painter.useProgram('extrusion', ['EXTRUSION']);

    gl.uniformMatrix4fv(outlineProgram.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['extrusion-translate'],
        layer.paint['extrusion-translate-anchor']
    ));

        // Draw extrusion rectangle.
    var zScale = Math.pow(2, painter.transform.zoom) / 50000;
    gl.uniformMatrix4fv(outlineProgram.u_matrix, false, mat4.scale(
        mat4.create(),
        coord.posMatrix,
        [1, 1, zScale, 1])
    );

    gl.uniform4fv(outlineProgram.u_color, util.premultiply(strokeColor));
    gl.uniform1f(outlineProgram.u_opacity, 0.1);


    // if (false && image) {
    //     // TODO
    //     setPattern(image, opacity, tile, coord, painter, outlineProgram);
    // } else {
    //     console.log(strokeColor);
    //     gl.uniform4fv(outlineProgram.u_color, util.premultiply(strokeColor || [0,0,0,1]));
    //     gl.uniform1f(outlineProgram.u_opacity, 1.0 /*opacity*/);
    //     // TODO delete ^^ -- just for debugging
    // }

    gl.uniform2f(outlineProgram.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    painter.enableTileClippingMask(coord);

    for (var k = 0; k < bufferGroups.length; k++) {
        var group = bufferGroups[k];
        group.secondVaos[layer.id].bind(gl, outlineProgram, group.layout.vertex, group.layout.element2);
        gl.drawElements(gl.LINES, group.layout.element2.length * 2, gl.UNSIGNED_SHORT, 0);
    }
}

function setPattern(image, opacity, tile, coord, painter, program) {
    // console.log(image, tile);
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

    // Draw extrusion rectangle.
    var zScale = Math.pow(2, painter.transform.zoom) / 50000;
    gl.uniformMatrix4fv(program.u_matrix, false, mat4.scale(
        mat4.create(),
        coord.posMatrix,
        [1, 1, zScale, 1])
    );

    gl.activeTexture(gl.TEXTURE0);
    painter.spriteAtlas.bind(gl, true);
}
