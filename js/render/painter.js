'use strict';

var glutil = require('./glutil.js');
var browser = require('../util/browser.js');
var GlyphAtlas = require('../symbol/glyphatlas.js');
var glmatrix = require('../lib/glmatrix.js');
var FrameHistory = require('./framehistory.js');

var mat4 = glmatrix.mat4;

var drawSymbol = require('./drawsymbol.js');
var drawLine = require('./drawline.js');
var drawFill = require('./drawfill.js');
var drawRaster = require('./drawraster.js');
var drawDebug = require('./drawdebug.js');
var drawBackground = require('./drawbackground.js');
var drawVertices = require('./drawvertices.js');

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
}

/*
 * Update the GL viewport, projection matrix, and transforms to compensate
 * for a new width and height value.
 */
GLPainter.prototype.resize = function(width, height) {
    var gl = this.gl;
    // Initialize projection matrix
    this.projectionMatrix = mat4.create();
    mat4.ortho(this.projectionMatrix, 0, width, height, 0, 0, -1);

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
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

    gl.enable(gl.STENCIL_TEST);

    this.glyphAtlas = new GlyphAtlas(1024, 1024);
    // this.glyphAtlas.debug = true;
    this.glyphAtlas.bind(gl);

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
        ['a_pos', 'a_extrude', 'a_linesofar'],
        ['u_matrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_dasharray', 'u_blur']);

    this.linepatternShader = gl.initializeShader('linepattern',
        ['a_pos', 'a_extrude', 'a_linesofar'],
        ['u_matrix', 'u_exmatrix', 'u_linewidth', 'u_ratio', 'u_pattern_size', 'u_pattern_tl', 'u_pattern_br', 'u_point', 'u_blur', 'u_fade']);

    this.dotShader = gl.initializeShader('dot',
        ['a_pos'],
        ['u_matrix', 'u_size', 'u_color', 'u_blur']);

    this.sdfShader = gl.initializeShader('sdf',
        ['a_pos', 'a_tex', 'a_offset', 'a_angle', 'a_minzoom', 'a_maxzoom', 'a_rangeend', 'a_rangestart', 'a_labelminzoom'],
        ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_angle', 'u_zoom', 'u_flip', 'u_fadedist', 'u_minfadezoom', 'u_maxfadezoom', 'u_fadezoom']);

    this.iconShader = gl.initializeShader('icon',
        ['a_pos', 'a_tex', 'a_offset', 'a_angle', 'a_minzoom', 'a_maxzoom', 'a_rangeend', 'a_rangestart', 'a_labelminzoom'],
        ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_angle', 'u_zoom', 'u_flip', 'u_fadedist', 'u_minfadezoom', 'u_maxfadezoom', 'u_fadezoom', 'u_opacity']);

    this.outlineShader = gl.initializeShader('outline',
        ['a_pos'],
        ['u_matrix', 'u_color', 'u_world']
    );

    this.patternShader = gl.initializeShader('pattern',
        ['a_pos'],
        ['u_matrix', 'u_pattern_tl', 'u_pattern_br', 'u_mix', 'u_patternmatrix', 'u_opacity', 'u_image']
    );

    this.fillShader = gl.initializeShader('fill',
        ['a_pos'],
        ['u_matrix', 'u_color']
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

GLPainter.prototype.drawClippingMask = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.tile.posMatrix, this.tile.exMatrix);
    gl.colorMask(false, false, false, false);

    // Clear the entire stencil buffer, except for the 7th bit, which stores
    // the global clipping mask that allows us to avoid drawing in regions of
    // tiles we've already painted in.
    gl.clearStencil(0x0);
    gl.stencilMask(0xBF);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // The stencil test will fail always, meaning we set all pixels covered
    // by this geometry to 0x80. We use the highest bit 0x80 to mark the regions
    // we want to draw in. All pixels that have this bit *not* set will never be
    // drawn in.
    gl.stencilFunc(gl.EQUAL, 0xC0, 0x40);
    gl.stencilMask(0xC0);
    gl.stencilOp(gl.REPLACE, gl.KEEP, gl.KEEP);

    // Draw the clipping mask
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.tileExtentBuffer.itemSize, gl.SHORT, false, 8, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.itemCount);

    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0x00);
    gl.colorMask(true, true, true, true);
};

GLPainter.prototype.prepareBuffers = function() {}; // Overridden by headless tests.

/*
 * Draw a new tile to the context, assuming that the viewport is
 * already correctly set.
 */
GLPainter.prototype.draw = function glPainterDraw(tile, style, layers, params, matrix) {
    this.tile = tile;

    // false when drawing a group of composited layers
    if (tile && !matrix) {
        // Draw the root clipping mask.
        this.drawClippingMask();
    }

    if (!Array.isArray(layers)) console.warn('Layers is not an array');

    this.frameHistory.record(this.transform.zoom);

    // Draw layers front-to-back.
    // Layers are already in reverse order from style.restructure()
    for (var i = 0, len = layers.length; i < len; i++) {
        this.applyStyle(layers[i], style, tile && tile.buckets, params, tile, matrix);
    }

    if (params.debug) {
        drawDebug(this.gl, this, tile, params);
    }
};

GLPainter.prototype.applyStyle = function(layer, style, buckets, params, tile, matrix) {
    var gl = this.gl;

    var layerStyle = style.computed[layer.id];
    if (!layerStyle || layerStyle.hidden) return;

    if (layer.layers && layer.type === 'raster') {
        drawRaster(gl, this, buckets[layer.bucket], layerStyle, params, style, layer, tile);
    } else if (params.background) {
        drawBackground(gl, this, undefined, layerStyle, this.identityMatrix, params, style.sprite);
    } else {

        var bucket = buckets[layer.bucket];
        // There are no vertices yet for this layer.
        if (!bucket || (bucket.hasData && !bucket.hasData())) return;

        var type = bucket.type;

        if (bucket.minZoom && this.transform.zoom < bucket.minZoom) return;
        if (bucket.maxZoom && this.transform.zoom >= bucket.maxZoom) return;

        var draw = type === 'symbol' ? drawSymbol :
                   type === 'fill' ? drawFill :
                   type === 'line' ? drawLine :
                   type === 'raster' ? drawRaster : null;

        if (draw) {
            var useMatrix = matrix || this.tile.posMatrix;
            draw(gl, this, bucket, layerStyle, useMatrix, params, style.sprite);
        } else {
            console.warn('No bucket type specified');
        }

        if (params.vertices && !layer.layers) {
            drawVertices(gl, this, bucket);
        }
    }
};

// Draws non-opaque areas. This is for debugging purposes.
GLPainter.prototype.drawStencilBuffer = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.identityMatrix);

    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

    // Drw the filling quad where the stencil buffer isn't set.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.backgroundBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4fv(this.fillShader.u_color, [0, 0, 0, 0.5]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.backgroundBuffer.itemCount);

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
};

GLPainter.prototype.translateMatrix = function(matrix, z, translate, anchor) {
    if (!translate[0] && !translate[1]) return matrix;

    if (anchor === 'viewport') {
        var sin_a = Math.sin(-this.transform.angle);
        var cos_a = Math.cos(-this.transform.angle);
        translate = [
            translate[0] * cos_a - translate[1] * sin_a,
            translate[0] * sin_a + translate[1] * cos_a
        ];
    }

    var tilePixelRatio = this.transform.scale / (1 << z) / 8;
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
