'use strict';

require('./glutil.js');
var GlyphAtlas = require('../text/glyphatlas.js');
var glmatrix = require('../lib/glmatrix.js');

var mat4 = glmatrix.mat4;
var mat2 = glmatrix.mat2;

var drawText = require('./drawtext.js');
var drawLine = require('./drawline.js');
var drawFill = require('./drawfill.js');
var drawPoint = require('./drawpoint.js');
var drawDebug = require('./drawdebug.js');
var drawVertices = require('./drawvertices.js');

/*
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 */
module.exports = GLPainter;
function GLPainter(gl) {
    this.gl = gl;
    this.bufferProperties = {};

    this.framebufferObject = null;
    this.framebufferTextures = [null];
    this.currentFramebuffer = 0;

    var t = this.tileExtent = 4096;
    this.tileExtentBuffer = new Int16Array([0, 0, t, 0, 0, t, t, t]);

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

    // Initialize 1:1 matrix that paints the coordinates at the same screen
    // position as the vertex.
    var mvMatrix = mat4.create();
    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, mvMatrix, [0, 0, 1]);
    this.backgroundMatrix = mat4.create();
    mat4.mul(this.backgroundMatrix, this.projectionMatrix, mvMatrix);


    this.width = width * window.devicePixelRatio;
    this.height = height * window.devicePixelRatio;
    gl.viewport(0, 0, this.width, this.height);

    for (var i = this.framebufferTextures.length - 1; i > 0; i--) {
        gl.deleteTexture(this.framebufferTextures.pop());
    }
};


GLPainter.prototype.setup = function() {
    var gl = this.gl;

    gl.verbose = true;

    // We are blending the new pixels *behind* the existing pixels. That way we can
    // draw front-to-back and use then stencil buffer to cull opaque pixels early.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

    gl.clearStencil(0);
    gl.enable(gl.STENCIL_TEST);

    this.glyphAtlas = new GlyphAtlas(1024, 1024);
    // this.glyphAtlas.debug = true;
    this.glyphAtlas.bind(gl);

    // Initialize shaders
    this.debugShader = gl.initializeShader('debug',
        ['a_pos'],
        ['u_posmatrix', 'u_pointsize', 'u_color']);

    this.areaShader = gl.initializeShader('area',
        ['a_pos'],
        ['u_posmatrix', 'u_linewidth', 'u_color']);

    this.compositeShader = gl.initializeShader('composite',
        ['a_pos'],
        ['u_posmatrix', 'u_opacity']);

    this.rasterShader = gl.initializeShader('raster',
        ['a_pos'],
        ['u_posmatrix', 'u_brightness_low', 'u_brightness_high', 'u_saturation', 'u_spin']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_extrude', 'a_linesofar'],
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug', 'u_ratio', 'u_dasharray', 'u_point', 'u_gamma']);

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

    var background = [ -32768, -32768, 32766, -32768, -32768, 32766, 32766, 32766 ];
    var backgroundArray = new Int16Array(background);
    this.backgroundBuffer = gl.createBuffer();
    this.bufferProperties.backgroundItemSize = 2;
    this.bufferProperties.backgroundNumItems = background.length / this.bufferProperties.backgroundItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundArray, gl.STATIC_DRAW);

    var debug = [ 0, 0, /**/ 4095, 0, /**/ 4095, 4095, /**/ 0, 4095, /**/ 0, 0];
    var debugArray = new Int16Array(debug);
    this.debugBuffer = gl.createBuffer();
    this.bufferProperties.debugItemSize = 2;
    this.bufferProperties.debugNumItems = debug.length / this.bufferProperties.debugItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, debugArray, gl.STATIC_DRAW);

    // Add a small buffer to prevent cracks between tiles
    var b = 4;
    var tilebounds = [-b, -b, 4095 + b, -b, -b, 4095 + b, 4095 + b, 4095 + b];
    var tileboundsArray = new Int16Array(tilebounds);
    this.tileboundsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileboundsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, tileboundsArray, gl.STATIC_DRAW);

    // tile stencil buffer
    this.tileStencilBuffer = gl.createBuffer();
    this.bufferProperties.tileStencilItemSize = 2;
    this.bufferProperties.tileStencilNumItems = 4;

    this.textBuffer = gl.createBuffer();
    this.bufferProperties.textItemSize = 2;


    // sdf glyph rendering
    this.glyphVertexBuffer = gl.createBuffer();
    this.bufferProperties.glyphVertexItemSize = 2;

    this.glyphTextureBuffer = gl.createBuffer();
    this.bufferProperties.glyphTextureItemSize = 2;
};

/*
 * Reset the drawing canvas by clearing both visible content and the
 * buffers we use for test operations
 */
GLPainter.prototype.clear = function() {
    var gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0x0);
    gl.stencilMask(0xFF);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    for (var i = 1; i < this.framebufferTextures.length; i++) {
        this.currentFramebuffer = i;
        this.bindCurrentFramebuffer();
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    }

    this.currentFramebuffer = 0;
    this.bindCurrentFramebuffer();
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

/*
 * Initialize the viewport of the map in order to prepare to
 * draw a new area. Typically for each tile viewport is called, and then
 * draw.
 *
 * @param {number} z zoom level
 * @param {number} x column
 * @param {number} y row
 * @param {object} transform a Transform instance
 * @param {number} tileSize
 */
GLPainter.prototype.viewport = function glPainterViewport(z, x, y, transform) {
    var gl = this.gl;

    // Initialize model-view matrix that converts from the tile coordinates
    // to screen coordinates.
    var tileScale = Math.pow(2, z);
    var scale = transform.worldSize / tileScale;

    // TODO: remove
    this.scale = scale;
    this.transform = transform;

    // Use 64 bit floats to avoid precision issues.
    this.posMatrix = new Float64Array(16);
    mat4.identity(this.posMatrix);

    mat4.translate(this.posMatrix, this.posMatrix, transform.centerOrigin);
    mat4.rotateZ(this.posMatrix, this.posMatrix, transform.angle);
    mat4.translate(this.posMatrix, this.posMatrix, transform.icenterOrigin);

    mat4.translate(this.posMatrix, this.posMatrix, [ -transform.x, -transform.y, 0 ]);
    mat4.translate(this.posMatrix, this.posMatrix, [ scale * x, scale * y, 1 ]);

    this.rotationMatrix = mat2.create();
    mat2.rotate(this.rotationMatrix, this.rotationMatrix, transform.angle);

    this.resizeMatrix = new Float64Array(16);
    mat4.multiply(this.resizeMatrix, this.projectionMatrix, this.posMatrix);
    mat4.rotateZ(this.resizeMatrix, this.resizeMatrix, -transform.angle);
    mat4.scale(this.resizeMatrix, this.resizeMatrix, [2, 2, 1]);

    mat4.scale(this.posMatrix, this.posMatrix, [ scale / this.tileExtent, scale / this.tileExtent, 1 ]);
    mat4.multiply(this.posMatrix, this.projectionMatrix, this.posMatrix);

    // Convert to 32-bit floats after we're done with all the transformations.
    this.posMatrix = new Float32Array(this.posMatrix);
    this.resizeMatrix = new Float32Array(this.resizeMatrix);

    // The extrusion matrix.
    this.exMatrix = mat4.clone(this.projectionMatrix);
    mat4.rotateZ(this.exMatrix, this.exMatrix, transform.angle);

    // Update tile stencil buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.tileExtentBuffer, gl.STREAM_DRAW);

    // Draw the root clipping mask.
    this.drawClippingMask();
    this.stencilClippingMaskDirty = true;

    this.tilePixelRatio = transform.scale / (1 << z) / 8;
};

GLPainter.prototype.drawClippingMask = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.posMatrix, this.exMatrix);
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.vertexAttribPointer(this.fillShader.a_pos, this.bufferProperties.tileStencilItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.tileStencilNumItems);

    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0x00);
    gl.colorMask(true, true, true, true);
};

GLPainter.prototype.bindCurrentFramebuffer = function() {
    var gl = this.gl;

    if (this.currentFramebuffer > 0) {
        if (!this.framebufferObject) {
            this.framebufferObject = gl.createFramebuffer();

            // There's only one stencil buffer that we always attach.
            var stencil = this.stencilBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, gl.drawingBufferWidth, gl.drawingBufferHeight);
            this.stencilClippingMaskDirty = true;
        }

        // We create a separate texture for every level.
        if (!this.framebufferTextures[this.currentFramebuffer]) {
            var texture = this.framebufferTextures[this.currentFramebuffer] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferObject);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTextures[this.currentFramebuffer], 0);

        // Only draw the clipping mask once to the stencil buffer.
        if (this.stencilClippingMaskDirty) {
            this.drawClippingMask();
            this.stencilClippingMaskDirty = false;
        }
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
};

GLPainter.prototype.attachFramebuffer = function() {
    this.currentFramebuffer++;
    this.bindCurrentFramebuffer();
};

GLPainter.prototype.detachFramebuffer = function() {
    this.currentFramebuffer--;
    this.bindCurrentFramebuffer();
};

GLPainter.prototype.getFramebufferTexture = function() {
    return this.framebufferTextures[this.currentFramebuffer];
};

GLPainter.prototype.drawRaster = function glPainterDrawRaster(tile, style) {
    var gl = this.gl;
    var painter = this;

    var layerStyle = style.computed.satellite;

    if (!layerStyle || typeof layerStyle.saturation === 'undefined') return;

    gl.switchShader(painter.rasterShader, painter.posMatrix, painter.exMatrix);

    this.gl.uniform1f(painter.rasterShader.u_brightness_low, layerStyle.brightness_low);
    this.gl.uniform1f(painter.rasterShader.u_brightness_high, layerStyle.brightness_high);
    this.gl.uniform1f(painter.rasterShader.u_saturation, layerStyle.saturation);
    this.gl.uniform1f(painter.rasterShader.u_spin, layerStyle.spin);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileboundsBuffer);
    tile.bind(gl);

    gl.vertexAttribPointer(
        painter.rasterShader.a_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);
};

/*
 * Draw a new tile to the context, assuming that the viewport is
 * already correctly set.
 */
GLPainter.prototype.draw = function glPainterDraw(tile, style, layers, params) {

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
        this.drawComposited(layerStyle, buckets, params, style, layer.layers);
    } else if (layer.bucket === 'background') {
        drawFill(gl, this, undefined, layerStyle, params, style.sprite, true);
    } else {

        var bucket = buckets[layer.bucket];
        // There are no vertices yet for this layer.
        if (!bucket || !bucket.indices) return;

        if (layerStyle.translate) {
            var translation = [
                layerStyle.translate[0] / this.tilePixelRatio,
                layerStyle.translate[1] / this.tilePixelRatio,
                0];
            this.translatedMatrix = new Float32Array(16);
            mat4.translate(this.translatedMatrix, this.posMatrix, translation);
        }

        var type = bucket.info.type,
            draw = type === 'text' ? drawText :
                   type === 'fill' ? drawFill :
                   type === 'line' ? drawLine :
                   type === 'point' ? drawPoint : null;

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

GLPainter.prototype.drawBackground = function(color, everything) {
    var gl = this.gl;

    // Draw background.
    gl.switchShader(this.areaShader, this.backgroundMatrix);
    if (everything) gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(color[3] == 1 ? 0x80 : 0x00);

    gl.uniform4fv(this.areaShader.u_color, color);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(
        this.areaShader.a_pos,
        this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    if (everything) gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0x00);
};

GLPainter.prototype.drawComposited = function(layerStyle, buckets, params, style, layers) {
    var opaque = typeof layerStyle.opacity === 'undefined' || layerStyle.opacity === 1,
        gl = this.gl;

    if (!opaque) {
        this.attachFramebuffer();
    }

    // Draw layers front-to-back.
    for (var i = layers.length - 1; i >= 0; i--) {
        this.applyStyle(layers[i], style, buckets, params);
    }

    if (!opaque) {
        var texture = this.getFramebufferTexture();
        this.detachFramebuffer();

        gl.switchShader(this.compositeShader, this.posMatrix, this.exMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.compositeShader.u_image, 0);

        gl.uniform1f(this.compositeShader.u_opacity, layerStyle.opacity);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
        gl.vertexAttribPointer(this.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
};

// Draws non-opaque areas. This is for debugging purposes.
GLPainter.prototype.drawStencilBuffer = function() {
    var gl = this.gl;
    gl.switchShader(this.fillShader, this.backgroundMatrix);

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
