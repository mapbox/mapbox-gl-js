'use strict';

require('./glutil.js');
var GlyphAtlas = require('../text/glyphatlas.js');
var glmatrix = require('../lib/glmatrix.js');
var chroma = require('../lib/chroma.js');
var mat4 = glmatrix.mat4;
var mat2 = glmatrix.mat2;

var textVertices = require('../lib/debug_text.js');

var assert = typeof DEBUG !== 'undefined' && DEBUG ? require('../util/assert.js') : false;


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
        ['a_pos', 'a_slope'],
        ['u_posmatrix', 'u_size', 'u_tl', 'u_br', 'u_rotationmatrix', 'u_color', 'u_invert']);

    this.sdfShader = gl.initializeShader('sdf',
        ['a_pos', 'a_tex', 'a_offset', 'a_angle', 'a_minzoom', 'a_maxzoom', 'a_rangeend', 'a_rangestart', 'a_labelminzoom'],
        ['u_posmatrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_angle', 'u_zoom', 'u_flip', 'u_fadefactor']);

    this.outlineShader = gl.initializeShader('outline',
        ['a_pos'],
        ['u_posmatrix', 'u_color', 'u_world']
    );

    this.patternShader = gl.initializeShader('pattern',
        ['a_pos'],
        ['u_posmatrix', 'u_color', 'u_pattern_tl', 'u_pattern_br', 'u_pattern_size', 'u_offset', 'u_mix', 'u_rotate']
    );

    this.fillShader = gl.initializeShader('fill',
        ['a_pos'],
        ['u_posmatrix', 'u_color']
    );

    this.debugPointShader = gl.initializeShader('debug_point',
        ['a_pos'],
        ['u_posmatrix', 'u_color', 'u_pointsize', 'u_scale']
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
    if (assert) assert.equal(arguments.length, 0);
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
    if (assert) assert.equal(arguments.length, 0);
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
 * @param {number} pixelRatio
 */
GLPainter.prototype.viewport = function glPainterViewport(z, x, y, transform, tileSize, pixelRatio) {
    var gl = this.gl;
    var tileExtent = 4096;

    // Initialize model-view matrix that converts from the tile coordinates
    // to screen coordinates.
    var tileScale = Math.pow(2, z);
    var scale = transform.scale * tileSize / tileScale;

    // TODO: remove
    this.scale = scale;
    this.transform = transform;

    // Use 64 bit floats to avoid precision issues.
    this.posMatrix = new Float64Array(16);
    mat4.identity(this.posMatrix);

    mat4.translate(this.posMatrix, this.posMatrix, transform.centerOrigin);
    mat4.rotateZ(this.posMatrix, this.posMatrix, transform.angle);
    mat4.translate(this.posMatrix, this.posMatrix, transform.icenterOrigin);
    mat4.translate(this.posMatrix, this.posMatrix, [ transform.x, transform.y, 0 ]);
    mat4.translate(this.posMatrix, this.posMatrix, [ scale * x, scale * y, 1 ]);

    this.rotationMatrix = mat2.create();
    mat2.identity(this.rotationMatrix);
    mat2.rotate(this.rotationMatrix, this.rotationMatrix, transform.angle);
    this.rotationMatrix = new Float32Array(this.rotationMatrix);

    this.identityMat2 = new Float32Array([1, 0, 0, 1]);

    this.resizeMatrix = new Float64Array(16);
    mat4.multiply(this.resizeMatrix, this.projectionMatrix, this.posMatrix);
    mat4.rotateZ(this.resizeMatrix, this.resizeMatrix, -transform.angle);
    mat4.scale(this.resizeMatrix, this.resizeMatrix, [2, 2, 1]);
    this.resizeMatrix = new Float32Array(this.resizeMatrix);

    mat4.scale(this.posMatrix, this.posMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);
    mat4.multiply(this.posMatrix, this.projectionMatrix, this.posMatrix);

    // Convert to 32-bit floats after we're done with all the transformations.
    this.posMatrix = new Float32Array(this.posMatrix);

    // The extrusion matrix.
    this.exMatrix = mat4.create();
    mat4.identity(this.exMatrix);
    mat4.multiply(this.exMatrix, this.projectionMatrix, this.exMatrix);
    mat4.rotateZ(this.exMatrix, this.exMatrix, transform.angle);

    // Update tile stencil buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([ 0, 0, tileExtent, 0, 0, tileExtent, tileExtent, tileExtent ]), gl.STREAM_DRAW);

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

GLPainter.prototype.drawRaster = function glPainterDrawRaster(tile, style, layers, params) {
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
    var painter = this,
        gl = this.gl,
        stats = {};


    var result = {};

    var appliedStyle = style.computed;

    var buckets = style.stylesheet.buckets;

    if (assert) assert.ok(Array.isArray(layers), 'Layers is not an array');

    // Draw layers front-to-back.
    // Layers are already in reverse order from style.restructure()
    layers.forEach(applyStyle);

    function applyStyle(layer) {
        var layerStyle = appliedStyle[layer.name];
        if (!layerStyle || layerStyle.hidden) return;

        if (layer.layers) {
            drawComposited(gl, painter, layerStyle, tile, stats, params, applyStyle, layer.layers);
        } else if (layer.bucket === 'background') {
            drawFill(gl, painter, layerData, layerStyle, tile, stats, params, style.sprite, true);
        } else {
            var bucket_info = buckets[layer.bucket];
            if (assert) assert.ok(bucket_info, 'bucket info exists');

            var layerData = tile.layers[layer.bucket];
            // There are no vertices yet for this layer.
            if (!layerData) return;

            if (!stats[layer.bucket]) {
                stats[layer.bucket] = { lines: 0, triangles: 0 };
            }

            if (bucket_info.text) {
                drawText(gl, painter, layerData, layerStyle, tile, stats[layer.bucket], params, bucket_info);
            } else if (bucket_info.type === 'fill') {
                drawFill(gl, painter, layerData, layerStyle, tile, stats[layer.bucket], params, style.sprite);
            } else if (bucket_info.type == 'line') {
                drawLine(gl, painter, layerData, layerStyle, tile, stats[layer.bucket], params, style.sprite);
            } else if (bucket_info.type == 'point') {
                drawPoint(gl, painter, layerData, layerStyle, tile, stats[layer.bucket], params, style.sprite, bucket_info);
            } else {
                console.warn('Unknown bucket type ' + bucket_info.type);
            }

            if (params.vertices && !layer.layers) {
                drawVertices(gl, painter, layerData, layerStyle, tile, stats, params);
            }
        }
    }

    if (params.debug) {
        drawDebug(gl, painter, tile, stats, params);
    }

    return result;
};

GLPainter.prototype.drawBackground = function(color, everything) {
    var gl = this.gl;
    var glColor = color.gl();

    // Draw background.
    gl.switchShader(this.areaShader, this.backgroundMatrix);
    if (everything) gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(glColor[3] == 1 ? 0x80 : 0x00);

    gl.uniform4fv(this.areaShader.u_color, glColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(
        this.areaShader.a_pos,
        this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    if (everything) gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0x00);
};

function drawComposited(gl, painter, layerStyle, tile, stats, params, applyStyle, layers) {
    var opaque = typeof layerStyle.opacity === 'undefined' || layerStyle.opacity === 1;

    if (!opaque) {
        painter.attachFramebuffer();
    }

    // Draw layers front-to-back.
    layers = layers.slice().reverse();

    layers.forEach(applyStyle);

    if (!opaque) {
        var texture = painter.getFramebufferTexture();
        painter.detachFramebuffer();

        gl.switchShader(painter.compositeShader, painter.posMatrix, painter.exMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(painter.compositeShader.u_image, 0);

        gl.uniform1f(painter.compositeShader.u_opacity, layerStyle.opacity);

        gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
        gl.vertexAttribPointer(painter.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

function drawFill(gl, painter, layer, layerStyle, tile, stats, params, imageSprite, background) {
    if (assert) assert.ok(typeof layerStyle.color === 'object', 'layer style has a color');

    var color = layerStyle.color.gl();
    var alpha = color[3];

    // TODO: expose this to the stylesheet.
    var evenodd = false;

    var buffer, vertex, elements;
    var begin, end;

    if (!background) {
        // Draw the stencil mask.
        {
            // We're only drawing to the first seven bits (== support a maximum of
            // 127 overlapping polygons in one place before we get rendering errors).
            gl.stencilMask(0x3F);
            gl.clear(gl.STENCIL_BUFFER_BIT);

            // Draw front facing triangles. Wherever the 0x80 bit is 1, we are
            // increasing the lower 7 bits by one if the triangle is a front-facing
            // triangle. This means that all visible polygons should be in CCW
            // orientation, while all holes (see below) are in CW orientation.
            gl.stencilFunc(gl.NOTEQUAL, 0x80, 0x80);

            if (evenodd) {
                // When we draw an even/odd winding fill, we just invert all the bits.
                gl.stencilOp(gl.INVERT, gl.KEEP, gl.KEEP);
            } else {
                // When we do a nonzero fill, we count the number of times a pixel is
                // covered by a counterclockwise polygon, and subtract the number of
                // times it is "uncovered" by a clockwise polygon.
                gl.stencilOpSeparate(gl.FRONT, gl.INCR_WRAP, gl.KEEP, gl.KEEP);
                gl.stencilOpSeparate(gl.BACK, gl.DECR_WRAP, gl.KEEP, gl.KEEP);
            }

            // When drawing a shape, we first draw all shapes to the stencil buffer
            // and incrementing all areas where polygons are
            gl.colorMask(false, false, false, false);

            // Draw the actual triangle fan into the stencil buffer.
            gl.switchShader(painter.fillShader, painter.posMatrix, painter.exMatrix);

            // Draw all buffers
            buffer = layer.fillBufferIndex;
            while (buffer <= layer.fillBufferIndexEnd) {
                vertex = tile.geometry.fillBuffers[buffer].vertex;
                vertex.bind(gl);

                elements = tile.geometry.fillBuffers[buffer].elements;
                elements.bind(gl);

                begin = buffer == layer.fillBufferIndex ? layer.fillElementsIndex : 0;
                end = buffer == layer.fillBufferIndexEnd ? layer.fillElementsIndexEnd : elements.index;

                gl.vertexAttribPointer(painter.fillShader.a_pos, vertex.itemSize / 2, gl.SHORT, false, 0, 0);
                gl.drawElements(gl.TRIANGLES, (end - begin) * 3, gl.UNSIGNED_SHORT, begin * 6);

                stats.triangles += (end - begin);

                buffer++;
            }

            // Now that we have the stencil mask in the stencil buffer, we can start
            // writing to the color buffer.
            gl.colorMask(true, true, true, true);
        }

        // From now on, we don't want to update the stencil buffer anymore.
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.stencilMask(0x0);

        // Because we're drawing top-to-bottom, and we update the stencil mask
        // below, we have to draw the outline first (!)
        if (layerStyle.antialias && params.antialiasing) {
            gl.switchShader(painter.outlineShader, painter.posMatrix, painter.exMatrix);
            gl.lineWidth(2 * window.devicePixelRatio);

            if (layerStyle.stroke) {
                // If we defined a different color for the fill outline, we are
                // going to ignore the bits in 0x3F and just care about the global
                // clipping mask.
                gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
            } else {
                // Otherwise, we only want to draw the antialiased parts that are
                // *outside* the current shape. This is important in case the fill
                // or stroke color is translucent. If we wouldn't clip to outside
                // the current shape, some pixels from the outline stroke overlapped
                // the (non-antialiased) fill.
                gl.stencilFunc(gl.EQUAL, 0x80, 0xBF);
            }

            gl.uniform2f(painter.outlineShader.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.uniform4fv(painter.outlineShader.u_color, layerStyle.stroke ? layerStyle.stroke.gl() : color);

            // Draw all buffers
            buffer = layer.fillBufferIndex;
            while (buffer <= layer.fillBufferIndexEnd) {
                vertex = tile.geometry.fillBuffers[buffer].vertex;
                vertex.bind(gl);

                begin = buffer == layer.fillBufferIndex ? layer.fillVertexIndex : 0;
                end = buffer == layer.fillBufferIndexEnd ? layer.fillVertexIndexEnd : vertex.index;
                gl.vertexAttribPointer(painter.outlineShader.a_pos, 2, gl.SHORT, false, 0, 0);
                gl.drawArrays(gl.LINE_STRIP, begin, (end - begin));

                stats.lines += (end - begin);


                buffer++;
            }
        }

    }


    var imagePos = layerStyle.image && imageSprite.getPosition(layerStyle.image, true);

    if (imagePos) {
        // Draw texture fill

        var factor = 8 / Math.pow(2, painter.transform.zoom - params.z);
        var mix = painter.transform.z % 1.0;
        var imageSize = [imagePos.size[0] * factor, imagePos.size[1] * factor];

        var offset = [
            (params.x * 4096) % imageSize[0],
            (params.y * 4096) % imageSize[1]
        ];

        gl.switchShader(painter.patternShader, painter.posMatrix, painter.exMatrix);
        gl.uniform1i(painter.patternShader.u_image, 0);
        gl.uniform2fv(painter.patternShader.u_pattern_size, imageSize);
        gl.uniform2fv(painter.patternShader.u_offset, offset);
        gl.uniform2fv(painter.patternShader.u_rotate, [1, 1]);
        gl.uniform2fv(painter.patternShader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(painter.patternShader.u_pattern_br, imagePos.br);
        gl.uniform4fv(painter.patternShader.u_color, color);
        gl.uniform1f(painter.patternShader.u_mix, mix);
        imageSprite.bind(gl, true);

    } else {
        // Draw filling rectangle.
        gl.switchShader(painter.fillShader, painter.posMatrix, painter.exMatrix);
        gl.uniform4fv(painter.fillShader.u_color, color);
    }

    if (background) {
        gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

    } else {
        // Only draw regions that we marked
        gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x3F);
    }

    // Draw a rectangle that covers the entire viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileStencilBuffer);
    gl.vertexAttribPointer(painter.fillShader.a_pos, painter.bufferProperties.tileStencilItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.tileStencilNumItems);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}

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

function drawLine(gl, painter, layer, layerStyle, tile, stats, params, imageSprite) {
    if (assert) assert.ok(typeof layerStyle.color === 'object', 'layer style has a color');

    var width = layerStyle.width;
    if (width === null) return;

    var offset = (layerStyle.offset || 0) / 2;
    var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
    var outset = offset + width / 2 + 0.5;

    var imagePos = layerStyle.image && imageSprite.getPosition(layerStyle.image);
    var shader;

    if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.zoom - params.z);

        imageSprite.bind(gl, true);

        //factor = Math.pow(2, 4 - painter.transform.zoom + params.z);
        gl.switchShader(painter.linepatternShader, painter.posMatrix, painter.exMatrix);
        shader = painter.linepatternShader;
        gl.uniform2fv(painter.linepatternShader.u_pattern_size, [imagePos.size[0] * factor, imagePos.size[1] ]);
        gl.uniform2fv(painter.linepatternShader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(painter.linepatternShader.u_pattern_br, imagePos.br);
        gl.uniform1f(painter.linepatternShader.u_fade, painter.transform.z % 1.0);

    } else {
        gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
        gl.uniform2fv(painter.lineShader.u_dasharray, layerStyle.dasharray || [1, -1]);
        shader = painter.lineShader;
    }

    gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
    gl.uniform1f(shader.u_ratio, painter.tilePixelRatio);
    gl.uniform1f(shader.u_gamma, window.devicePixelRatio);

    var color = layerStyle.color.gl();
    if (!params.antialiasing) {
        color[3] = Infinity;
        gl.uniform4fv(shader.u_color, color);
    } else {
        gl.uniform4fv(shader.u_color, color);
    }

    var vertex = tile.geometry.lineVertex;
    vertex.bind(gl);
    gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8, 0);
    gl.vertexAttribPointer(shader.a_extrude, 2, gl.BYTE, false, 8, 6);
    gl.vertexAttribPointer(shader.a_linesofar, 2, gl.SHORT, false, 8, 4);

    var begin = layer.lineVertexIndex;
    var count = layer.lineVertexIndexEnd - begin;

    gl.uniform1f(shader.u_point, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, begin, count);

    if (layerStyle.linejoin === 'round') {
        gl.uniform1f(shader.u_point, 1);
        gl.drawArrays(gl.POINTS, begin, count);
    }

    // statistics
    stats.lines += count;
}

function drawPoint(gl, painter, layer, layerStyle, tile, stats, params, imageSprite, bucket_info) {
    var imagePos = imageSprite.getPosition(layerStyle.image);

    if (imagePos) {
        gl.switchShader(painter.pointShader, painter.posMatrix, painter.exMatrix);

        gl.uniform1i(painter.pointShader.u_invert, layerStyle.invert);
        gl.uniform2fv(painter.pointShader.u_size, imagePos.size);
        gl.uniform2fv(painter.pointShader.u_tl, imagePos.tl);
        gl.uniform2fv(painter.pointShader.u_br, imagePos.br);

        var color = (layerStyle.color || chroma([0, 0, 0, 0], 'gl')).gl();
        gl.uniform4fv(painter.pointShader.u_color, color);

        var rotate = layerStyle.alignment === 'line';
        gl.uniformMatrix2fv(painter.pointShader.u_rotationmatrix, false,
                rotate ? painter.rotationMatrix: painter.identityMat2);

        // if icons are drawn rotated, or of the map is rotating use linear filtering for textures
        var linearFilter = rotate || params.rotating || params.zooming;
        imageSprite.bind(gl, linearFilter);

        // skip some line markers based on zoom level
        var stride = bucket_info.marker ?
            Math.max(0.125, Math.pow(2, Math.floor(Math.log(painter.tilePixelRatio)/Math.LN2))) :
            1;

        var vertex = tile.geometry.lineVertex;
        vertex.bind(gl);

        gl.vertexAttribPointer(painter.pointShader.a_pos, 4, gl.SHORT, false, 8 / stride, 0);
        gl.vertexAttribPointer(painter.pointShader.a_slope, 2, gl.BYTE, false, 8 / stride, 6);

        var begin = layer.lineVertexIndex;
        var count = layer.lineVertexIndexEnd - begin;

        gl.drawArrays(gl.POINTS, begin * stride, count * stride);

        // statistics
        stats.lines += count;
    }
}

function drawText(gl, painter, layer, layerStyle, tile, stats, params, bucket_info) {
    var exMatrix = mat4.create();
    mat4.identity(exMatrix);
    mat4.multiply(exMatrix, painter.projectionMatrix, exMatrix);
    if (bucket_info.path == 'curve') {
        mat4.rotateZ(exMatrix, exMatrix, painter.transform.angle);
    }
    mat4.scale(exMatrix, exMatrix, [ bucket_info.fontSize / 24, bucket_info.fontSize / 24, 1 ]);

    gl.switchShader(painter.sdfShader, painter.posMatrix, exMatrix);
    gl.disable(gl.STENCIL_TEST);

    painter.glyphAtlas.updateTexture(gl);

    gl.uniform2f(painter.sdfShader.u_texsize, painter.glyphAtlas.width, painter.glyphAtlas.height);

    tile.geometry.glyphVertex.bind(gl);
    gl.vertexAttribPointer(painter.sdfShader.a_pos, 2, gl.SHORT, false, 24, 0);
    gl.vertexAttribPointer(painter.sdfShader.a_offset, 2, gl.SHORT, false, 24, 4);
    gl.vertexAttribPointer(painter.sdfShader.a_tex, 2, gl.UNSIGNED_SHORT, false, 24, 8);
    gl.vertexAttribPointer(painter.sdfShader.a_angle, 1, gl.UNSIGNED_SHORT, false, 24, 12);
    gl.vertexAttribPointer(painter.sdfShader.a_minzoom, 1, gl.UNSIGNED_SHORT, false, 24, 14);
    gl.vertexAttribPointer(painter.sdfShader.a_rangeend, 1, gl.UNSIGNED_SHORT, false, 24, 16);
    gl.vertexAttribPointer(painter.sdfShader.a_rangestart, 1, gl.UNSIGNED_SHORT, false, 24, 18);
    gl.vertexAttribPointer(painter.sdfShader.a_maxzoom, 1, gl.UNSIGNED_SHORT, false, 24, 20);
    gl.vertexAttribPointer(painter.sdfShader.a_labelminzoom, 1, gl.UNSIGNED_SHORT, false, 24, 22);

    if (!params.antialiasing) {
        gl.uniform1f(painter.sdfShader.u_gamma, 0);
    } else {
        gl.uniform1f(painter.sdfShader.u_gamma, 2.5 / bucket_info.fontSize / window.devicePixelRatio);
    }

    // Convert the -pi/2..pi/2 to an int16 range.
    var angle = painter.transform.angle * 32767 / (Math.PI / 2);
    gl.uniform1f(painter.sdfShader.u_angle, angle);

    gl.uniform1f(painter.sdfShader.u_flip, bucket_info.path === 'curve' ? 1 : 0);

    // current zoom level
    gl.uniform1f(painter.sdfShader.u_zoom, Math.floor(painter.transform.z * 10));

    var begin = layer.glyphVertexIndex;
    var end = layer.glyphVertexIndexEnd;

    gl.uniform1f(painter.sdfShader.u_fadefactor, layerStyle['fade-dist'] || 0);

    // Draw text first.
    gl.uniform4fv(painter.sdfShader.u_color, layerStyle.color.gl());
    gl.uniform1f(painter.sdfShader.u_buffer, (256 - 64) / 256);
    gl.drawArrays(gl.TRIANGLES, begin, end - begin);

    stats.triangles += end - begin;

    if (layerStyle.stroke) {
        // Draw halo underneath the text.
        gl.uniform4fv(painter.sdfShader.u_color, layerStyle.stroke.gl());
        gl.uniform1f(painter.sdfShader.u_buffer, 64 / 256);
        gl.drawArrays(gl.TRIANGLES, begin, end - begin);
    }

    gl.enable(gl.STENCIL_TEST);
}

function drawDebug(gl, painter, tile, stats, params) {
    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.switchShader(painter.debugShader, painter.posMatrix, painter.exMatrix);

    // draw bounding rectangle
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugBuffer);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.bufferProperties.debugItemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(painter.debugShader.u_color, 1, 0, 0, 1);
    gl.lineWidth(4);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.bufferProperties.debugNumItems);

    // draw tile coordinate
    var coord = params.z + '/' + params.x + '/' + params.y;

    var vertices = [];
    vertices = vertices.concat(textVertices(coord, 50, 200, 5));
    var top = 400;
    for (var name in stats) {
        if (stats[name].lines || stats[name].triangles) {
            var text = name + ': ';
            if (stats[name].lines) text += ' ' + stats[name].lines + ' lines';
            if (stats[name].triangles) text += ' ' + stats[name].triangles + ' tris';
            vertices = vertices.concat(textVertices(text, 50, top, 3));
            top += 100;
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.textBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.bufferProperties.textItemSize, gl.SHORT, false, 0, 0);
    gl.lineWidth(8 * window.devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 1, 1, 1, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.bufferProperties.textItemSize);
    gl.lineWidth(2 * window.devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.bufferProperties.textItemSize);

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}

function drawVertices(gl, painter, layer, layerStyle, tile, stats, params) {
    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
    gl.switchShader(painter.debugPointShader, painter.posMatrix, painter.exMatrix);

    // // Draw debug points.
    gl.uniform1f(painter.debugPointShader.u_pointsize, 3);
    gl.uniform4fv(painter.debugPointShader.u_color, [0.25, 0, 0, 0.25]);

    // Draw the actual triangle fan into the stencil buffer.

    // Draw all buffers
    var buffer = layer.fillBufferIndex;
    while (buffer <= layer.fillBufferIndexEnd) {
        var vertex = tile.geometry.fillBuffers[buffer].vertex;
        var begin = buffer == layer.fillBufferIndex ? layer.fillVertexIndex : 0;
        var end = buffer == layer.fillBufferIndexEnd ? layer.fillVertexIndexEnd : vertex.index;
        var count = end - begin;
        if (count) {
            vertex.bind(gl);
            gl.vertexAttribPointer(painter.debugPointShader.a_pos, 2, gl.SHORT, false, 0, 0);
            gl.uniform1f(painter.debugPointShader.u_scale, 1);
            gl.drawArrays(gl.POINTS, begin, (end - begin));
        }
        buffer++;
    }


    // Draw line buffers
    var begin = layer.lineVertexIndex;
    var count = layer.lineVertexIndexEnd - begin;
    if (count) {
        tile.geometry.lineVertex.bind(gl);
        gl.vertexAttribPointer(painter.debugPointShader.a_pos, 2, gl.SHORT, false, 8, 0);
        gl.uniform1f(painter.debugPointShader.u_scale, 2);
        gl.drawArrays(gl.POINTS, begin, count);
    }

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
