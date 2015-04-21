'use strict';

var glutil = require('./gl_util');
var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;
var FrameHistory = require('./frame_history');
var TileCoord = require('../source/tile_coord');

/*
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 */
module.exports = Painter;
function Painter(gl, transform) {
    this.gl = glutil.extend(gl);
    this.transform = transform;

    this.reusableTextures = {};
    this.preFbos = {};

    this.frameHistory = new FrameHistory();

    this.setup();

    // Within each layer there are 3 distinct z-planes that can be drawn to.
    // This is implemented using the WebGL depth buffer.
    this.numSublayers = 3;
    this.depthEpsilon = 1 / Math.pow(2, 16);
}

/*
 * Update the GL viewport, projection matrix, and transforms to compensate
 * for a new width and height value.
 */
Painter.prototype.resize = function(width, height) {
    var gl = this.gl;

    this.width = width * browser.devicePixelRatio;
    this.height = height * browser.devicePixelRatio;
    gl.viewport(0, 0, this.width, this.height);

};


Painter.prototype.setup = function() {
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
        ['u_matrix', 'u_color']);

    this.rasterShader = gl.initializeShader('raster',
        ['a_pos', 'a_texture_pos'],
        ['u_matrix', 'u_brightness_low', 'u_brightness_high', 'u_saturation_factor', 'u_spin_weights', 'u_contrast_factor', 'u_opacity0', 'u_opacity1', 'u_image0', 'u_image1', 'u_tl_parent', 'u_scale_parent', 'u_buffer_scale']);

    this.circleShader = gl.initializeShader('circle',
        ['a_pos'],
        ['u_matrix', 'u_exmatrix', 'u_blur', 'u_size', 'u_color']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_extra', 'u_antialiasingmatrix', 'u_offset', 'u_exmatrix']);

    this.linepatternShader = gl.initializeShader('linepattern',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_linewidth', 'u_ratio', 'u_pattern_size_a', 'u_pattern_size_b', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_blur', 'u_fade', 'u_opacity', 'u_extra', 'u_antialiasingmatrix', 'u_offset']);

    this.linesdfpatternShader = gl.initializeShader('linesdfpattern',
        ['a_pos', 'a_data'],
        ['u_matrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_patternscale_a', 'u_tex_y_a', 'u_patternscale_b', 'u_tex_y_b', 'u_image', 'u_sdfgamma', 'u_mix', 'u_extra', 'u_antialiasingmatrix', 'u_offset']);

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

    this.setExtent(4096);

    // The debugTextBuffer is used to draw tile IDs for debugging
    this.debugTextBuffer = gl.createBuffer();
    this.debugTextBuffer.itemSize = 2;
};

/**
 * Rebind the necessary buffers to render at a different extent than
 * the current one. No-ops if the extent is not changing.
 *
 * @param {number} newExtent
 * @example
 * this.setExtent(4096);
 * @private
 */
Painter.prototype.setExtent = function(newExtent) {
    if (!newExtent || newExtent === this.tileExtent) return;

    this.tileExtent = newExtent;

    var gl = this.gl;

    // The tileExtentBuffer is used when drawing to a full *tile*
    this.tileExtentBuffer = gl.createBuffer();
    this.tileExtentBuffer.itemSize = 4;
    this.tileExtentBuffer.itemCount = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Int16Array([
            // tile coord x, tile coord y, texture coord x, texture coord y
            0, 0, 0, 0,
            this.tileExtent, 0, 32767, 0,
            0, this.tileExtent, 0, 32767,
            this.tileExtent, this.tileExtent,  32767, 32767
        ]),
        gl.STATIC_DRAW);

    // The debugBuffer is used to draw tile outlines for debugging
    this.debugBuffer = gl.createBuffer();
    this.debugBuffer.itemSize = 2;
    this.debugBuffer.itemCount = 5;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Int16Array([
            0, 0, this.tileExtent - 1, 0, this.tileExtent - 1, this.tileExtent - 1, 0, this.tileExtent - 1, 0, 0]),
        gl.STATIC_DRAW);
};

/*
 * Reset the color buffers of the drawing canvas.
 */
Painter.prototype.clearColor = function() {
    var gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
};

/*
 * Reset the drawing canvas by clearing the stencil buffer so that we can draw
 * new tiles at the same location, while retaining previously drawn pixels.
 */
Painter.prototype.clearStencil = function() {
    var gl = this.gl;
    gl.clearStencil(0x0);
    gl.stencilMask(0xFF);
    gl.clear(gl.STENCIL_BUFFER_BIT);
};

Painter.prototype.clearDepth = function() {
    var gl = this.gl;
    gl.clearDepth(1);
    this.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
};

Painter.prototype._renderTileClippingMasks = function(coords, sourceMaxZoom) {
    var gl = this.gl;
    gl.colorMask(false, false, false, false);
    this.depthMask(false);
    gl.disable(gl.DEPTH_TEST);

    // Only write clipping IDs to the last 5 bits. The first three are used for drawing fills.
    gl.stencilMask(0xF8);
    // Tests will always pass, and ref value will be written to stencil buffer.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    var idNext = 1;
    this._tileClippingMaskIDs = {};
    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        var id = this._tileClippingMaskIDs[coord.id] = (idNext++) << 3;

        gl.stencilFunc(gl.ALWAYS, id, 0xF8);

        gl.switchShader(this.fillShader, this.calculatePosMatrix(coord, sourceMaxZoom));

        // Draw the clipping mask
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
        gl.vertexAttribPointer(this.fillShader.a_pos, this.tileExtentBuffer.itemSize, gl.SHORT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.itemCount);
    }

    gl.stencilMask(0x00);
    gl.colorMask(true, true, true, true);
    this.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
};

Painter.prototype.enableTileClippingMask = function(coord) {
    var gl = this.gl;
    gl.stencilFunc(gl.EQUAL, this._tileClippingMaskIDs[coord.id], 0xF8);
};

// Overridden by headless tests.
Painter.prototype.prepareBuffers = function() {};
Painter.prototype.bindDefaultFramebuffer = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

var draw = {
    symbol: require('./draw_symbol'),
    circle: require('./draw_circle'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    raster: require('./draw_raster'),
    background: require('./draw_background'),
    debug: require('./draw_debug')
};

Painter.prototype.render = function(style, options) {
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

    this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

    this.renderPass({isOpaquePass: true});
    this.renderPass({isOpaquePass: false});
};

Painter.prototype.renderPass = function(options) {
    var groups = this.style._groups;
    var isOpaquePass = options.isOpaquePass;
    this.currentLayer = isOpaquePass ? this.style._order.length : -1;

    for (var i = 0; i < groups.length; i++) {
        var group = groups[isOpaquePass ? groups.length - 1 - i : i];
        var source = this.style.sources[group.source];

        var coords = [];
        if (source) {
            coords = source.getVisibleCoordinates();
            this.clearStencil();
            if (source.prepare) source.prepare();
            if (source.isTileClipped) {
                this._renderTileClippingMasks(coords, source.maxzoom);
            }
        }

        if (isOpaquePass) {
            this.gl.disable(this.gl.BLEND);
            this.isOpaquePass = true;
        } else {
            this.gl.enable(this.gl.BLEND);
            this.isOpaquePass = false;
            coords.reverse();
        }

        for (var j = 0; j < group.length; j++) {
            var layer = group[isOpaquePass ? group.length - 1 - j : j];
            this.currentLayer += isOpaquePass ? -1 : 1;
            this.renderLayer(this, source, layer, coords);
        }

        draw.debug(this, coords);
    }
};

Painter.prototype.depthMask = function(mask) {
    if (mask !== this._depthMask) {
        this._depthMask = mask;
        this.gl.depthMask(mask);
    }
};

Painter.prototype.renderLayer = function(painter, source, layer, coords) {
    if (layer.hidden) return;
    if (layer.type !== 'background' && !coords.length) return;
    draw[layer.type](painter, source, layer, coords);
};

// Draws non-opaque areas. This is for debugging purposes.
Painter.prototype.drawStencilBuffer = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.identityMatrix);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

    // Drw the filling quad where the stencil buffer isn't set.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.backgroundBuffer.itemSize, gl.SHORT, false, 0, 0);

    gl.uniform4fv(this.fillShader.u_color, [0, 0, 0, 0.5]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.itemCount);
};

Painter.prototype.setDepthSublayer = function(n) {
    var farDepth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
    var nearDepth = farDepth - 1 + this.depthRange;
    this.gl.depthRange(nearDepth, farDepth);
};

Painter.prototype.translatePosMatrix = function(matrix, tile, translate, anchor) {
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

/**
 * Calculate the posMatrix that this tile uses to display itself in a map,
 * given a coordinate as (z, x, y) and a transform
 * @param {Object} transform
 * @private
 */
Painter.prototype.calculatePosMatrix = function(coord, maxZoom) {
    var tileExtent = 4096;
    if (coord instanceof TileCoord) {
        coord = coord.toCoordinate();
    }
    var transform = this.transform;

    if (maxZoom === undefined) maxZoom = Infinity;

    // Initialize model-view matrix that converts from the tile coordinates
    // to screen coordinates.

    // if z > maxzoom then the tile is actually a overscaled maxzoom tile,
    // so calculate the matrix the maxzoom tile would use.
    var z = Math.min(coord.zoom, maxZoom);
    var x = coord.column;
    var y = coord.row;

    var scale = transform.worldSize / Math.pow(2, z);

    // The position matrix
    var posMatrix = new Float64Array(16);

    mat4.identity(posMatrix);
    mat4.translate(posMatrix, posMatrix, [x * scale, y * scale, 0]);
    mat4.scale(posMatrix, posMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);
    mat4.multiply(posMatrix, transform.projMatrix, posMatrix);

    return new Float32Array(posMatrix);
};

Painter.prototype.saveTexture = function(texture) {
    var textures = this.reusableTextures[texture.size];
    if (!textures) {
        this.reusableTextures[texture.size] = [texture];
    } else {
        textures.push(texture);
    }
};


Painter.prototype.getTexture = function(size) {
    var textures = this.reusableTextures[size];
    return textures && textures.length > 0 ? textures.pop() : null;
};
