'use strict';

var glutil = require('./gl_util');
var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;
var FrameHistory = require('./frame_history');

/*
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 */
module.exports = GLPainter;
function GLPainter(gl, transform) {
    this.gl = glutil.extend(gl);
    this.transform = transform;

    this.reusableTextures = {};
    this.preFbos = {};

    this.tileExtent = 4096;
    this.frameHistory = new FrameHistory();

    this.setup();

    this.depthEpsilon = 1 / Math.pow(2, 16);
}

/*
 * Update the GL viewport, projection matrix, and transforms to compensate
 * for a new width and height value.
 */
GLPainter.prototype.resize = function(width, height) {
    var gl = this.gl;

    this.width = width * browser.devicePixelRatio;
    this.height = height * browser.devicePixelRatio;
    gl.viewport(0, 0, this.width, this.height);

};


GLPainter.prototype.setup = function() {
    var gl = this.gl;

    gl.verbose = true;

    // We are blending the new pixels *behind* the existing pixels. That way we can
    // draw front-to-back and use then stencil buffer to cull opaque pixels early.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.STENCIL_TEST);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    this._depthMask = false;
    gl.depthMask(false);

    // Initialize shaders
    this.debugShader = gl.initializeShader('debug',
        ['a_pos'],
        ['u_matrix', 'u_pointsize', 'u_color']);

    this.gaussianShader = gl.initializeShader('gaussian',
        ['a_pos'],
        ['u_matrix', 'u_image', 'u_offset']);

    this.rasterShader = gl.initializeShader('raster',
        ['a_pos', 'a_texture_pos'],
        ['u_matrix', 'u_brightness_low', 'u_brightness_high', 'u_saturation_factor', 'u_spin_weights', 'u_contrast_factor', 'u_opacity0', 'u_opacity1', 'u_image0', 'u_image1', 'u_tl_parent', 'u_scale_parent', 'u_buffer_scale']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_extra', 'u_antialiasingmatrix']);

    this.linepatternShader = gl.initializeShader('linepattern',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_exmatrix', 'u_linewidth', 'u_ratio', 'u_pattern_size_a', 'u_pattern_size_b', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_blur', 'u_fade', 'u_opacity']);

    this.linesdfpatternShader = gl.initializeShader('linesdfpattern',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_patternscale_a', 'u_tex_y_a', 'u_patternscale_b', 'u_tex_y_b', 'u_image', 'u_sdfgamma', 'u_mix']);

    this.dotShader = gl.initializeShader('dot',
        ['a_pos'],
        ['u_matrix', 'u_size', 'u_color', 'u_blur']);

    this.sdfShader = gl.initializeShader('sdf',
        ['a_pos', 'a_offset', 'a_data1', 'a_data2'],
        ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_zoom', 'u_fadedist', 'u_minfadezoom', 'u_maxfadezoom', 'u_fadezoom', 'u_skewed', 'u_extra']);

    this.iconShader = gl.initializeShader('icon',
        ['a_pos', 'a_offset', 'a_data1', 'a_data2'],
        ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_zoom', 'u_fadedist', 'u_minfadezoom', 'u_maxfadezoom', 'u_fadezoom', 'u_opacity', 'u_skewed', 'u_extra']);

    this.outlineShader = gl.initializeShader('outline',
        ['a_pos'],
        ['u_matrix', 'u_color', 'u_world']
    );

    this.patternShader = gl.initializeShader('pattern',
        ['a_pos'],
        ['u_matrix', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_mix', 'u_patternscale_a', 'u_patternscale_b', 'u_opacity', 'u_image']
    );

    this.fillShader = gl.initializeShader('fill',
        ['a_pos'],
        ['u_matrix', 'u_color']
    );

    this.collisionBoxShader = gl.initializeShader('collisionbox',
        ['a_pos', 'a_extrude', 'a_data'],
        ['u_matrix', 'u_scale', 'u_zoom', 'u_maxzoom']
    );

    this.identityMatrix = mat4.create();

    // The backgroundBuffer is used when drawing to the full *canvas*
    this.backgroundBuffer = gl.createBuffer();
    this.backgroundBuffer.itemSize = 2;
    this.backgroundBuffer.itemCount = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // The tileExtentBuffer is used when drawing to a full *tile*
    this.tileExtentBuffer = gl.createBuffer();
    this.tileExtentBuffer.itemSize = 4;
    this.tileExtentBuffer.itemCount = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([
        // tile coord x, tile coord y, texture coord x, texture coord y
                      0, 0,                    0, 0,
        this.tileExtent, 0,                32767, 0,
                      0, this.tileExtent,      0, 32767,
        this.tileExtent, this.tileExtent,  32767, 32767
    ]), gl.STATIC_DRAW);

    // The debugBuffer is used to draw tile outlines for debugging
    this.debugBuffer = gl.createBuffer();
    this.debugBuffer.itemSize = 2;
    this.debugBuffer.itemCount = 5;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([0, 0, 4095, 0, 4095, 4095, 0, 4095, 0, 0]), gl.STATIC_DRAW);

    // The debugTextBuffer is used to draw tile IDs for debugging
    this.debugTextBuffer = gl.createBuffer();
    this.debugTextBuffer.itemSize = 2;
};

/*
 * Reset the color buffers of the drawing canvas.
 */
GLPainter.prototype.clearColor = function() {
    var gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
};

/*
 * Reset the drawing canvas by clearing the stencil buffer so that we can draw
 * new tiles at the same location, while retaining previously drawn pixels.
 */
GLPainter.prototype.clearStencil = function() {
    var gl = this.gl;
    gl.clearStencil(0x0);
    gl.stencilMask(0xFF);
    gl.clear(gl.STENCIL_BUFFER_BIT);
};

GLPainter.prototype.clearDepth = function() {
    var gl = this.gl;
    gl.clearDepth(1);
    this.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
};

GLPainter.prototype._drawClippingMasks = function(tiles) {
    var gl = this.gl;
    gl.colorMask(false, false, false, false);
    this.depthMask(false);
    gl.disable(gl.DEPTH_TEST);

    // Only write clipping IDs to the last 5 bits. The first three are used for drawing fills.
    gl.stencilMask(0xF8);
    // Tests will always pass, and ref value will be written to stencil buffer.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    var clipID = 1;
    for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        tile.clipID = clipID << 3;
        this._drawClippingMask(tile);
        clipID++;

    }

    gl.stencilMask(0x00);
    gl.colorMask(true, true, true, true);
    this.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
};

GLPainter.prototype._drawClippingMask = function(tile) {
    var gl = this.gl;
    gl.stencilFunc(gl.ALWAYS, tile.clipID, 0xF8);

    gl.switchShader(this.fillShader);
    gl.uniformMatrix4fv(this.fillShader.u_matrix, false, tile.posMatrix);

    // Draw the clipping mask
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.tileExtentBuffer.itemSize, gl.SHORT, false, 8, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.itemCount);
};

GLPainter.prototype.setClippingMask = function(tile) {
    var gl = this.gl;
    gl.stencilFunc(gl.EQUAL, tile.clipID, 0xF8);
};

GLPainter.prototype._prepareTile = function(tile) {
    var coord = tile.coord,
        z = coord.z,
        x = coord.x,
        y = coord.y,
        w = coord.w;

    // if z > maxzoom then the tile is actually a overscaled maxzoom tile,
    // so calculate the matrix the maxzoom tile would use.
    z = Math.min(z, tile.sourceMaxZoom);

    x += w * (1 << z);
    tile.calculateMatrices(z, x, y, this.transform, this);
};

GLPainter.prototype._prepareSource = function(source) {
    if (source) {
        this.clearStencil();
        var tiles = source.renderedTiles();

        for (var t = 0; t < tiles.length; t++) {
            this._prepareTile(tiles[t]);
        }

        this._drawClippingMasks(tiles);
    }

    return tiles;
};

// Overridden by headless tests.
GLPainter.prototype.prepareBuffers = function() {};
GLPainter.prototype.bindDefaultFramebuffer = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

var draw = {
    symbol: require('./draw_symbol'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    raster: require('./draw_raster'),
    background: require('./draw_background'),
    debug: require('./draw_debug'),
    vertices: require('./draw_vertices')
};

GLPainter.prototype.render = function(style, options) {

    this.style = style;
    this.options = options;

    this.lineAtlas = style.lineAtlas;

    this.spriteAtlas = style.spriteAtlas;
    this.spriteAtlas.setSprite(style.sprite);

    this.glyphAtlas = style.glyphAtlas;
    this.glyphAtlas.bind(this.gl);

    this.frameHistory.record(this.transform.zoom);

    this.prepareBuffers();
    this.clearColor();
    this.clearDepth();

    var numLayers = style._order.length;
    this.depthRangeSize = 1 - numLayers * 3 * this.depthEpsilon;
    this.currentLayer = numLayers;

    var group, layer, tiles;
    for (var i = style._groups.length - 1; i >= 0; i--) {
        group = style._groups[i];
        tiles = this._prepareSource(style.sources[group.source]);

        this.setOpaque();

        for (var l = group.length - 1; l >= 0; l--) {
            layer = group[l];
            this.currentLayer--;

            if (layer.hidden)
                continue;

            if (group.source === undefined) {
                draw.background(this, layer, this.identityMatrix, undefined);
            } else {
                this.drawLayer(layer, tiles);
            }
        }
    }

    this.currentLayer = 0;

    for (var m = 0; m < style._groups.length; m++) {
        group = style._groups[m];
        tiles = this._prepareSource(style.sources[group.source]);

        this.setTranslucent();

        for (var k = 0; k < group.length; k++) {
            layer = group[k];
            this.currentLayer++;

            if (layer.hidden)
                continue;

            if (group.source === undefined) {
                draw.background(this, layer, this.identityMatrix, undefined);
            } else {
                this.drawLayer(layer, tiles);
            }

        }
    }
};

GLPainter.prototype.setOpaque = function() {
    this.gl.disable(this.gl.BLEND);
    this.opaquePass = true;
};

GLPainter.prototype.setTranslucent = function() {
    this.gl.enable(this.gl.BLEND);
    this.opaquePass = false;
};

GLPainter.prototype.depthMask = function(mask) {
    if (mask !== this._depthMask) {
        this._depthMask = mask;
        this.gl.depthMask(mask);
    }
};

GLPainter.prototype.drawLayer = function(layer, tiles) {
    if (!tiles.length) return;
    draw[layer.type](this, layer, tiles);
};

GLPainter.prototype.setSublayer = function(n) {
    var maxSublayers = 3;
    var farDepth = 1 - ((1 + this.currentLayer) * maxSublayers + n) * this.depthEpsilon;
    var nearDepth = farDepth - this.depthRangeSize;
    this.gl.depthRange(nearDepth, farDepth);
};

GLPainter.prototype.translateMatrix = function(matrix, tile, translate, anchor) {
    if (!translate[0] && !translate[1]) return matrix;

    if (anchor === 'viewport') {
        var sinA = Math.sin(-this.transform.angle);
        var cosA = Math.cos(-this.transform.angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }

    var tilePixelRatio = this.transform.scale / (1 << tile.coord.z) / (tile.tileExtent / tile.tileSize);
    var translation = [
        translate[0] / tilePixelRatio,
        translate[1] / tilePixelRatio,
        0
    ];

    var translatedMatrix = new Float32Array(16);
    mat4.translate(translatedMatrix, matrix, translation);
    return translatedMatrix;
};

GLPainter.prototype.saveTexture = function(texture) {
    var textures = this.reusableTextures[texture.size];
    if (!textures) {
        this.reusableTextures[texture.size] = [texture];
    } else {
        textures.push(texture);
    }
};


GLPainter.prototype.getTexture = function(size) {
    var textures = this.reusableTextures[size];
    return textures && textures.length > 0 ? textures.pop() : null;
};
