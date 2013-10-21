/*
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 */
function GLPainter(gl) {
    this.gl = gl;
    this.bufferProperties = {};
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

    if (this.fboTexture) {
        gl.deleteTexture(this.fboTexture);
        delete this.fboTexture;
    }
};


GLPainter.prototype.setup = function() {
    var gl = this.gl;
    if (DEBUG) console.time('GLPainter#setup');

    gl.verbose = true;

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.BLEND);
    gl.clearStencil(0);
    gl.enable(gl.STENCIL_TEST);

    this.glyphAtlas = new GlyphAtlas(1024, 1024);
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
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug', 'u_ratio', 'u_dasharray', 'u_point']);

    this.labelShader = gl.initializeShader('label',
        ['a_pos', 'a_offset', 'a_tex'],
        ['u_texsize', 'u_sampler', 'u_posmatrix', 'u_resizematrix', 'u_color']);

    this.pointShader = gl.initializeShader('point',
        ['a_pos', 'a_slope'],
        ['u_posmatrix', 'u_size', 'u_tpos', 'u_tsize', 'u_rotationmatrix']);

    this.sdfShader = gl.initializeShader('sdf',
        ['a_pos', 'a_tex', 'a_offset', 'a_angle'],
        ['u_posmatrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_angle']);


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



    gl.enable(gl.DEPTH_TEST);

    if (DEBUG) console.timeEnd('GLPainter#setup');
};

/*
 * Reset the drawing canvas by clearing both visible content and the
 * buffers we use for test operations
 */
GLPainter.prototype.clear = function(background_color) {
    var gl = this.gl;
    gl.clearColor(background_color[0], background_color[1], background_color[2], background_color[3]);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
    mat4.translate(this.posMatrix, this.posMatrix, [ scale * x, scale * y, 0 ]);

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

    // draw depth mask
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    // gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.switchShader(this.debugShader, this.posMatrix, this.exMatrix);
    gl.vertexAttribPointer(this.debugShader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.tileStencilNumItems);

    // Increase the z depth so that from now on, we are drawing above the z stencil.
    // Note: We need to make a new object identity of the matrix so that shader
    // switches are updating the matrix correctly.
    mat4.translate(this.posMatrix, this.posMatrix, [ 0, 0, 1 ]);
    this.posMatrix = new Float32Array(this.posMatrix);

    // draw actual tile
    gl.depthFunc(gl.GREATER);
    gl.depthMask(false);
    gl.colorMask(true, true, true, true);

    this.tilePixelRatio = transform.scale / (1 << z) / 8;
};

GLPainter.prototype.drawRaster = function glPainterDrawRaster(tile, style, params) {

    var gl = this.gl;
    var painter = this;

    gl.switchShader(painter.rasterShader, painter.posMatrix, painter.exMatrix);
    gl.enable(gl.STENCIL_TEST);

    this.gl.uniform1f(painter.rasterShader.u_brightness_low, style.constants.satellite_brightness_low);
    this.gl.uniform1f(painter.rasterShader.u_brightness_high, style.constants.satellite_brightness_high);
    this.gl.uniform1f(painter.rasterShader.u_saturation, style.constants.satellite_saturation);
    this.gl.uniform1f(painter.rasterShader.u_spin, style.constants.satellite_spin);

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
GLPainter.prototype.draw = function glPainterDraw(tile, style, params) {
    var painter = this,
        gl = this.gl,
        stats = {};

    drawBackground(gl, painter, style);

    style.zoomed_layers.forEach(applyStyle);

    function applyStyle(layerStyle) {
        var bucket_info = style.buckets[layerStyle.bucket];

        var layer = tile.layers[layerStyle.bucket];
        var width, offset, inset, outset, buffer, vertex, begin, count, end;
        if (!layer && !layerStyle.layers) return;

        if (layerStyle.layers) {
            drawComposited(gl, painter, layer, layerStyle, tile, stats, params, applyStyle);
        } else if (bucket_info.type === 'fill') {
            drawFill(gl, painter, layer, layerStyle, tile, stats, params);
        } else if (bucket_info.type == 'line') {
            drawLine(gl, painter, layer, layerStyle, tile, stats, params);
        } else if (bucket_info.type == 'point') {
            drawPoint(gl, painter, layer, layerStyle, tile, stats, params, style.image_sprite);
        } else if (bucket_info.type == 'text') {
            drawText(gl, painter, layer, layerStyle, tile, stats, params, bucket_info);
        }

        if (params.vertices && !layerStyle.layers) {
            drawVertices(gl, painter, layer, layerStyle, tile, stats, params);
        }
    }

    if (params.debug) {
        drawDebug(gl, painter, tile, stats, params);
    }
};

function drawBackground(gl, painter, style) {
    // Draw background.
    gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
    gl.enable(gl.STENCIL_TEST);
    gl.uniform4fv(painter.areaShader.u_color, style.background_color);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
    gl.vertexAttribPointer(
        painter.areaShader.a_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);
}

function drawComposited(gl, painter, layer, layerStyle, tile, stats, params, applyStyle) {

    if (!painter.fbo) {
        painter.fbo = gl.createFramebuffer();
    }

    if (!painter.fboTexture) {
        painter.fboTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, painter.fboTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // this will fail when max texture size is smaller than the screen res
        // todo: check if this needs to be handled
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width, painter.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, painter.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, painter.fboTexture, 0);
    painter.clear([0,0,0,0]);

    layerStyle.layers.forEach(applyStyle);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, painter.fboTexture);

    gl.switchShader(painter.compositeShader, painter.posMatrix, painter.exMatrix);
    gl.uniform1f(painter.compositeShader.u_opacity, layerStyle.opacity);

    gl.enable(gl.STENCIL_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
    gl.vertexAttribPointer(painter.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return;
}

function drawFill(gl, painter, layer, layerStyle, tile, stats, params) {
    gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
    gl.uniform4fv(painter.areaShader.u_color, layerStyle.color);

    // First, draw to the stencil buffer, with INVERT on.
    gl.colorMask(false, false, false, false);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.stencilOp(gl.ZERO, gl.KEEP, gl.INVERT);
    gl.stencilFunc(gl.ALWAYS, 1, 1);
    gl.enable(gl.STENCIL_TEST);

    var buffer = layer.buffer,
        begin,
        end,
        count;

    while (buffer <= layer.bufferEnd) {
        vertex = tile.geometry.buffers[buffer].vertex;
        vertex.bind(gl);

        var fill = tile.geometry.buffers[buffer].fill;
        fill.bind(gl);

        begin = buffer == layer.buffer ? layer.fillIndex : 0;
        end = buffer == layer.bufferEnd ? layer.fillIndexEnd : fill.index;
        gl.vertexAttribPointer(painter.areaShader.a_pos, 4, gl.SHORT, false, 8, 0);
        gl.drawElements(gl.TRIANGLES, (end - begin) * 3, gl.UNSIGNED_SHORT, begin * 6);

        buffer++;

        // statistics
        if (!stats[layerStyle.bucket]) stats[layerStyle.bucket] = { lines: 0, triangles: 0 };
        stats[layerStyle.bucket].triangles += (end - begin);
    }

    // Then, draw the same thing (or a big, tile covering buffer) using the
    // stencil we just created.
    gl.stencilOp(gl.ZERO, gl.ZERO, gl.KEEP);
    gl.colorMask(true, true, true, true);
    gl.stencilMask(0xff);
    gl.stencilFunc(gl.EQUAL, 0xff, 0xff);

    // Set the stencil so that we only draw the outside antialiasing.
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
    gl.vertexAttribPointer(painter.areaShader.a_pos, painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);

    var width, offset, inset, outset;

    // Draw the line antialiasing with the stencil.
    if (layerStyle.antialias && params.antialiasing) {
        gl.stencilFunc(gl.EQUAL, 0x0, 0xff);
        width = 0.25;
        offset = 0;
        inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
        outset = offset + width / 2 + 0.5;
        gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
        gl.uniform2fv(painter.lineShader.u_linewidth, [ outset, inset ]);
        gl.uniform4fv(painter.lineShader.u_color, layerStyle.color);
        gl.uniform1f(painter.lineShader.u_ratio, painter.tilePixelRatio);
        gl.uniform2fv(painter.lineShader.u_dasharray, layerStyle.dasharray || [1, -1]);

        buffer = layer.buffer;
        while (buffer <= layer.bufferEnd) {
            vertex = tile.geometry.buffers[buffer].vertex;
            vertex.bind(gl);
            gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
            gl.vertexAttribPointer(painter.lineShader.a_extrude, 2, gl.BYTE, false, 8, 6);
            gl.vertexAttribPointer(painter.lineShader.a_linesofar, 2, gl.SHORT, false, 8, 4);

            begin = buffer == layer.buffer ? layer.vertexIndex : 0;
            count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;
            gl.drawArrays(gl.TRIANGLE_STRIP, begin, count - begin);

            // statistics
            if (!stats[layerStyle.bucket]) stats[layerStyle.bucket] = { lines: 0, triangles: 0 };
            stats[layerStyle.bucket].lines += (count - begin);

            buffer++;
        }
    }
}

function drawLine(gl, painter, layer, layerStyle, tile, stats, params) {
    var begin, end, count;
    gl.disable(gl.STENCIL_TEST);
    width = layerStyle.width;
    offset = (layerStyle.offset || 0) / 2;
    inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
    outset = offset + width / 2 + 0.5;
    gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
    gl.uniform2fv(painter.lineShader.u_linewidth, [ outset, inset ]);
    gl.uniform1f(painter.lineShader.u_ratio, painter.tilePixelRatio);
    gl.uniform2fv(painter.lineShader.u_dasharray, layerStyle.dasharray || [1, -1]);

    if (!params.antialiasing) {
        gl.uniform4fv(painter.lineShader.u_color, [layerStyle.color[0], layerStyle.color[1], layerStyle.color[2], Infinity]);
    } else {
        gl.uniform4fv(painter.lineShader.u_color, layerStyle.color);
    }

    var buffer = layer.buffer;
    while (buffer <= layer.bufferEnd) {
        vertex = tile.geometry.buffers[buffer].vertex;
        vertex.bind(gl);
        gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
        gl.vertexAttribPointer(painter.lineShader.a_extrude, 2, gl.BYTE, false, 8, 6);
        gl.vertexAttribPointer(painter.lineShader.a_linesofar, 2, gl.SHORT, false, 8, 4);

        begin = buffer == layer.buffer ? layer.vertexIndex : 0;
        count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;

        gl.uniform1f(painter.lineShader.u_point, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, begin, count - begin);

        if (layerStyle.linejoin === 'round') {
            gl.uniform1f(painter.lineShader.u_point, 1);
            gl.drawArrays(gl.POINTS, begin, count - begin);
        }

        // statistics
        if (!stats[layerStyle.bucket]) stats[layerStyle.bucket] = { lines: 0, triangles: 0 };
        stats[layerStyle.bucket].lines += (count - begin);

        buffer++;
    }
}

function drawPoint(gl, painter, layer, layerStyle, tile, stats, params, imageSprite) {
    var imagePos = imageSprite.getPosition(layerStyle.image);
    var buffer, begin, end, count;

    if (imagePos) {
        gl.disable(gl.STENCIL_TEST);
        gl.switchShader(painter.pointShader, painter.posMatrix, painter.exMatrix);

        gl.uniform2fv(painter.pointShader.u_size, [imagePos.width, imagePos.height]);
        gl.uniform2fv(painter.pointShader.u_tpos, [imagePos.x, imagePos.y]);
        gl.uniform2fv(painter.pointShader.u_tsize, imageSprite.getDimensions());

        var rotate = layerStyle.alignment === 'line';
        gl.uniformMatrix2fv(painter.pointShader.u_rotationmatrix, false,
                rotate ? painter.rotationMatrix: painter.identityMat2);

        imageSprite.bind(gl);

        // skip some line markers based on zoom level
        var stride = layer.info.marker ?
            Math.max(0.125, Math.pow(2, Math.floor(Math.log(painter.tilePixelRatio)/Math.LN2))) :
            1;

        buffer = layer.buffer;
        while (buffer <= layer.bufferEnd) {
            vertex = tile.geometry.buffers[buffer].vertex;
            vertex.bind(gl);

            gl.vertexAttribPointer(painter.pointShader.a_pos, 4, gl.SHORT, false, 8 / stride, 0);
            gl.vertexAttribPointer(painter.pointShader.a_slope, 2, gl.BYTE, false, 8 / stride, 6);

            begin = buffer == layer.buffer ? layer.vertexIndex : 0;
            count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;

            gl.drawArrays(gl.POINTS, begin * stride, (count - begin) * stride);

            // statistics
            if (!stats[layerStyle.bucket]) stats[layerStyle.bucket] = { lines: 0, triangles: 0 };
            stats[layerStyle.bucket].lines += (count - begin);


            buffer++;
        }
    }
}

function drawText(gl, painter, layer, layerStyle, tile, stats, params, bucket_info) {
    // var size = 4096 / painter.scale * layerStyle.fontSize;
    var size = layerStyle.fontSize;

    var exMatrix = mat4.create();
    mat4.identity(exMatrix);
    mat4.multiply(exMatrix, painter.projectionMatrix, exMatrix);
    if (bucket_info.path == 'curve') {
        mat4.rotateZ(exMatrix, exMatrix, painter.transform.angle);
    }
    mat4.scale(exMatrix, exMatrix, [ layerStyle.fontSize / 24, layerStyle.fontSize / 24, 1 ]);

    gl.switchShader(painter.sdfShader, painter.posMatrix, exMatrix);
    gl.disable(gl.STENCIL_TEST);

    painter.glyphAtlas.updateTexture(gl);

    gl.uniform2f(painter.sdfShader.u_texsize, painter.glyphAtlas.width, painter.glyphAtlas.height);

    tile.geometry.glyph.bind(gl);
    gl.vertexAttribPointer(painter.sdfShader.a_pos, 2, gl.SHORT, false, 16, 0);
    gl.vertexAttribPointer(painter.sdfShader.a_offset, 2, gl.SHORT, false, 16, 4);
    gl.vertexAttribPointer(painter.sdfShader.a_tex, 2, gl.UNSIGNED_SHORT, false, 16, 8);
    gl.vertexAttribPointer(painter.sdfShader.a_angle, 1, gl.FLOAT, false, 16, 12);

    if (!params.antialiasing) {
        gl.uniform1f(painter.sdfShader.u_gamma, 0);
    } else {
        gl.uniform1f(painter.sdfShader.u_gamma, 2 / layerStyle.fontSize / window.devicePixelRatio);
    }

    if (layerStyle.path == 'curve') {
        gl.uniform1f(painter.sdfShader.u_angle, painter.transform.angle);
    } else {
        gl.uniform1f(painter.sdfShader.u_angle, 0);

    }

    var begin = layer.glyphVertexIndex;
    var end = layer.glyphVertexIndexEnd;

    gl.uniform4fv(painter.sdfShader.u_color, [ 1, 1, 1, 0.85 ]);
    gl.uniform1f(painter.sdfShader.u_buffer, 64 / 256);
    gl.drawArrays(gl.TRIANGLES, begin, end - begin);

    gl.uniform4fv(painter.sdfShader.u_color, layerStyle.color);
    gl.uniform1f(painter.sdfShader.u_buffer, (256 - 64) / 256);
    gl.drawArrays(gl.TRIANGLES, begin, end - begin);
}

function drawDebug(gl, painter, tile, stats, params) {
    gl.disable(gl.STENCIL_TEST);
    gl.switchShader(painter.debugShader, painter.posMatrix, painter.exMatrix);

    // draw bounding rectangle
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugBuffer);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.bufferProperties.debugItemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(painter.debugShader.u_color, 1, 1, 1, 1);
    gl.lineWidth(4);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.bufferProperties.debugNumItems);

    // draw tile coordinate
    var coord = params.z + '/' + params.x + '/' + params.y;

    var vertices = [];
    vertices = vertices.concat(textVertices(coord, 50, 200, 5));
    var top = 400;
    for (var name in stats) {
        vertices = vertices.concat(textVertices(name + ': ' + stats[name].lines + '/' + stats[name].triangles, 50, top, 3));
        top += 100;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.textBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.bufferProperties.textItemSize, gl.SHORT, false, 0, 0);
    gl.lineWidth(3 * devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 1, 1, 1, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.bufferProperties.textItemSize);
    gl.lineWidth(1 * devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.bufferProperties.textItemSize);
}

function drawVertices(gl, painter, layer, layerStyle, tile, stats, params) {
    gl.disable(gl.STENCIL_TEST);
    gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);

    // Draw debug points.
    gl.uniform1f(painter.areaShader.u_pointsize, 2);
    gl.uniform4fv(painter.areaShader.u_color, [0, 0, 0, 0.25]);

    var buffer = layer.buffer, vertex, begin, end, count;
    while (buffer <= layer.bufferEnd) {
        vertex = tile.geometry.buffers[buffer].vertex;
        vertex.bind(gl);
        gl.vertexAttribPointer(painter.areaShader.a_pos, 4, gl.SHORT, false, 8, 0);
        // gl.vertexAttribPointer(painter.areaShader.a_extrude, 2, gl.BYTE, false, 8, 4);

        begin = buffer == layer.buffer ? layer.vertexIndex : 0;
        count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;
        gl.drawArrays(gl.POINTS, begin, count - begin);

        buffer++;
    }
}
