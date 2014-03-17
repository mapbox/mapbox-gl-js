'use strict';

require('./glutil.js');
var GlyphAtlas = require('../text/glyphatlas.js');
var glmatrix = require('../lib/glmatrix.js');

var mat4 = glmatrix.mat4;

var drawText = require('./drawtext.js');
var drawLine = require('./drawline.js');
var drawFill = require('./drawfill.js');
var drawPoint = require('./drawpoint.js');
var drawRaster = require('./drawraster.js');
var drawDebug = require('./drawdebug.js');
var drawComposited = require('./drawcomposited.js');
var drawVertices = require('./drawvertices.js');

/*
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 */
module.exports = GLPainter;
function GLPainter(gl, transform) {
    this.gl = gl;
    this.transform = transform;
    this.bufferProperties = {};

    this.framebufferObject = null;
    this.renderTextures = [];
    this.namedRenderTextures = {};

    this.tileExtent = 4096;

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

    this.width = width * window.devicePixelRatio;
    this.height = height * window.devicePixelRatio;
    gl.viewport(0, 0, this.width, this.height);

    for (var i = this.renderTextures.length - 1; i >= 0; i--) {
        gl.deleteTexture(this.renderTextures.pop());
    }
    if (this.stencilBuffer) {
        gl.deleteRenderbuffer(this.stencilBuffer);
        delete this.stencilBuffer;
    }
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
        ['u_posmatrix', 'u_pointsize', 'u_color']);

    this.compositeShader = gl.initializeShader('composite',
        ['a_pos'],
        ['u_posmatrix', 'u_opacity']);

    this.rasterShader = gl.initializeShader('raster',
        ['a_pos'],
        ['u_posmatrix', 'u_brightness_low', 'u_brightness_high', 'u_saturation', 'u_spin']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_extrude', 'a_linesofar'],
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug', 'u_ratio', 'u_dasharray', 'u_point', 'u_gamma', 'u_blur']);

    this.linepatternShader = gl.initializeShader('linepattern',
        ['a_pos', 'a_extrude', 'a_linesofar'],
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug', 'u_ratio', 'u_pattern_size', 'u_pattern_tl', 'u_pattern_br', 'u_point', 'u_gamma', 'u_fade']);

    this.labelShader = gl.initializeShader('label',
        ['a_pos', 'a_offset', 'a_tex'],
        ['u_texsize', 'u_sampler', 'u_posmatrix', 'u_resizematrix', 'u_color']);

    this.pointShader = gl.initializeShader('point',
        ['a_pos', 'a_angle', 'a_minzoom'],
        ['u_posmatrix', 'u_size', 'u_tl', 'u_br', 'u_rotationmatrix', 'u_color', 'u_invert', 'u_zoom']);

    this.dotShader = gl.initializeShader('dot',
        ['a_pos'],
        ['u_posmatrix', 'u_size', 'u_color', 'u_blur']);

    this.sdfShader = gl.initializeShader('sdf',
        ['a_pos', 'a_tex', 'a_offset', 'a_angle', 'a_minzoom', 'a_maxzoom', 'a_rangeend', 'a_rangestart', 'a_labelminzoom'],
        ['u_posmatrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_angle', 'u_zoom', 'u_flip', 'u_fadedist', 'u_minfadezoom', 'u_maxfadezoom', 'u_fadezoom']);

    this.outlineShader = gl.initializeShader('outline',
        ['a_pos'],
        ['u_posmatrix', 'u_color', 'u_world']
    );

    this.patternShader = gl.initializeShader('pattern',
        ['a_pos'],
        ['u_posmatrix', 'u_color', 'u_pattern_tl', 'u_pattern_br', 'u_pattern_size', 'u_offset', 'u_mix']
    );

    this.fillShader = gl.initializeShader('fill',
        ['a_pos'],
        ['u_posmatrix', 'u_color']
    );

    // The backgroundBuffer is used when drawing to the full *canvas*
    var background = [ -32768, -32768, 32766, -32768, -32768, 32766, 32766, 32766 ];
    var backgroundArray = new Int16Array(background);
    this.backgroundBuffer = gl.createBuffer();
    this.bufferProperties.backgroundItemSize = 2;
    this.bufferProperties.backgroundNumItems = background.length / this.bufferProperties.backgroundItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundArray, gl.STATIC_DRAW);

    // The tileExtentBuffer is used when drawing to a full *tile*
    var t = this.tileExtent;
    var tileExtentArray = new Int16Array([0, 0, t, 0, 0, t, t, t]);
    this.tileExtentBuffer = gl.createBuffer();
    this.bufferProperties.tileExtentItemSize = 2;
    this.bufferProperties.tileExtentNumItems = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileExtentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, tileExtentArray, gl.STATIC_DRAW);

    // The debugBuffer is used to draw tile outlines for debugging
    var debug = [ 0, 0, /**/ 4095, 0, /**/ 4095, 4095, /**/ 0, 4095, /**/ 0, 0];
    var debugArray = new Int16Array(debug);
    this.debugBuffer = gl.createBuffer();
    this.bufferProperties.debugItemSize = 2;
    this.bufferProperties.debugNumItems = debug.length / this.bufferProperties.debugItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, debugArray, gl.STATIC_DRAW);

    // The debugTextBuffer is used to draw tile IDs for debugging
    this.debugTextBuffer = gl.createBuffer();
    this.bufferProperties.debugTextItemSize = 2;
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
    gl.vertexAttribPointer(this.fillShader.a_pos, this.bufferProperties.tileExtentItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.tileExtentNumItems);

    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0x00);
    gl.colorMask(true, true, true, true);
};

// Set up a texture that can be drawn into
GLPainter.prototype.bindRenderTexture = function(name) {
    var gl = this.gl;

    if (name) {

        // Only create one framebuffer. Reuse it for every level.
        if (!this.framebufferObject) {
            this.framebufferObject = gl.createFramebuffer();
        }

        // There's only one stencil buffer that we always attach.
        if (!this.stencilBuffer) {
            var stencil = this.stencilBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, gl.drawingBufferWidth, gl.drawingBufferHeight);
            this.stencilClippingMaskDirty = true;
        }

        // We create a separate texture for every level.
        var texture = this.renderTextures.pop();
        if (!texture) {
            texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }

        this.namedRenderTextures[name] = texture;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferObject);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    this.clearColor();
};

GLPainter.prototype.freeRenderTexture = function(name) {
    this.renderTextures.push(this.namedRenderTextures[name]);
    delete this.namedRenderTextures[name];
};

/*
 * Draw a new tile to the context, assuming that the viewport is
 * already correctly set.
 */
GLPainter.prototype.draw = function glPainterDraw(tile, style, layers, params) {
    this.tile = tile;
    // Draw the root clipping mask.
    this.drawClippingMask();
    this.stencilClippingMaskDirty = true;

    if (!Array.isArray(layers)) console.warn('Layers is not an array');

    drawText.frame(this);

    // Draw layers front-to-back.
    // Layers are already in reverse order from style.restructure()
    for (var i = 0, len = layers.length; i < len; i++) {
        this.applyStyle(layers[i], style, tile.buckets, params);
    }

    if (params.debug) {
        drawDebug(this.gl, this, tile, params);
    }
};

GLPainter.prototype.applyStyle = function(layer, style, buckets, params) {
    var gl = this.gl;

    var layerStyle = style.computed[layer.name];
    if (!layerStyle || layerStyle.hidden) return;

    if (layer.layers) {
        drawComposited(gl, this, buckets, layerStyle, params, style, layer);
    } else if (layer.bucket === 'background') {
        drawFill(gl, this, undefined, layerStyle, params, style.sprite, true);
    } else {

        var bucket = buckets[layer.bucket];
        // There are no vertices yet for this layer.
        if (!bucket) return;

        if (layerStyle.translate) {
            var tilePixelRatio = this.transform.scale / (1 << params.z) / 8;
            var translation = [
                layerStyle.translate[0] / tilePixelRatio,
                layerStyle.translate[1] / tilePixelRatio,
                0];
            this.translatedMatrix = new Float32Array(16);
            mat4.translate(this.translatedMatrix, this.tile.posMatrix, translation);
        }

        var type = bucket.info.type,
            draw = type === 'text' ? drawText :
                   type === 'fill' ? drawFill :
                   type === 'line' ? drawLine :
                   type === 'point' ? drawPoint :
                   type === 'raster' ? drawRaster : null;

        if (draw) {
            draw(gl, this, bucket, layerStyle, params, style.sprite);
        } else {
            console.warn('Unknown bucket type ' + type);
        }

        if (layerStyle.translate) {
            this.translatedMatrix = null;
        }

        if (params.vertices && !layer.layers) {
            drawVertices(gl, this, bucket);
        }
    }
};

// Draws the color to the entire canvas
GLPainter.prototype.drawBackground = function(color) {
    var gl = this.gl;

    // Draw background.
    gl.switchShader(this.fillShader, this.projectionMatrix);
    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(color[3] == 1 ? 0x80 : 0x00);

    gl.uniform4fv(this.fillShader.u_color, color);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(
        this.fillShader.a_pos,
        this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0x00);
};

// Draws non-opaque areas. This is for debugging purposes.
GLPainter.prototype.drawStencilBuffer = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.projectionMatrix);

    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

    // Drw the filling quad where the stencil buffer isn't set.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.uniform4fv(this.fillShader.u_color, [0, 0, 0, 0.5]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
};
