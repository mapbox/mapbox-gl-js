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
    gl.viewport(0, 0, width * window.devicePixelRatio, height * window.devicePixelRatio);
};

GLPainter.prototype.setup = function() {
    var gl = this.gl;
    if (DEBUG) console.time('GLPainter#setup');

    gl.verbose = true;

    gl.clearColor(0, 0, 0, 0);
    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(
        gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE, gl.ONE);

    gl.enable(gl.BLEND);
    gl.clearStencil(0);
    gl.enable(gl.STENCIL_TEST);


    // Initialize shaders
    this.debugShader = gl.initializeShader('debug',
        ['a_pos'],
        ['u_posmatrix', 'u_pointsize', 'u_color']);

    this.areaShader = gl.initializeShader('area',
        ['a_pos'],
        ['u_posmatrix', 'u_linewidth', 'u_color']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_extrude'],
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug']);


    this.labelShader = gl.initializeShader('label',
        ['a_pos', 'a_tex'],
        ['u_sampler', 'u_posmatrix']);


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


    // tile stencil buffer
    this.tileStencilBuffer = gl.createBuffer();
    this.bufferProperties.tileStencilItemSize = 2;
    this.bufferProperties.tileStencilNumItems = 4;


    this.textBuffer = gl.createBuffer();
    this.bufferProperties.textItemSize = 2;

    gl.enable(gl.DEPTH_TEST);


    if (DEBUG) console.timeEnd('GLPainter#setup');
};

/*
 * Reset the drawing canvas by clearing both visible content and the
 * buffers we use for test operations
 */
GLPainter.prototype.clear = function() {
    var gl = this.gl;
    gl.clearColor(0.9, 0.9, 0.9, 1);
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

    // Use 64 bit floats to avoid precision issues.
    this.posMatrix = new Float64Array(16);
    mat4.identity(this.posMatrix);
    mat4.translate(this.posMatrix, this.posMatrix, [ transform.x, transform.y, 0 ]);
    mat4.rotateZ(this.posMatrix, this.posMatrix, transform.rotation);
    mat4.translate(this.posMatrix, this.posMatrix, [ scale * x, scale * y, 0 ]);
    mat4.scale(this.posMatrix, this.posMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);
    mat4.multiply(this.posMatrix, this.projectionMatrix, this.posMatrix);

    // Convert to 32-bit floats after we're done with all the transformations.
    this.posMatrix = new Float32Array(this.posMatrix);

    // The extrusion matrix.
    this.exMatrix = mat4.create();
    mat4.identity(this.exMatrix);
    mat4.rotateZ(this.exMatrix, this.exMatrix, transform.rotation);
    mat4.multiply(this.exMatrix, this.projectionMatrix, this.exMatrix);

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
};

/*
 * Draw a new tile to the context, assuming that the viewport is
 * already correctly set.
 */
GLPainter.prototype.draw = function glPainterDraw(tile, style, info) {
    var painter = this;
    var gl = this.gl;
    gl.switchShader(this.debugShader, painter.posMatrix, painter.exMatrix);
    gl.enable(gl.STENCIL_TEST);

    // // register the tile's geometry with the gl context, if it isn't bound yet.
    // if (!tile.geometry || !tile.geometry.bind(gl)) {
    //     return;
    // }

    background_color = parse_color('land', style_json.constants);

    // Draw background
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.debugShader.a_pos, this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(this.debugShader.u_color, background_color[0], background_color[1], background_color[2], background_color[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    // Vertex Buffer

    var labelTexture = tile.map.labelTexture;
    labelTexture.reset();

    style.forEach(applyStyle);

    function applyStyle(info) {
        var layer = tile.layers[info.data];
        if (layer) {
            if (info.type === 'fill') {
                gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
                gl.uniform4fv(painter.areaShader.u_color, [info.color[0], info.color[1], info.color[2], 1]);

                // First, draw to the stencil buffer, with INVERT on.
                gl.colorMask(false, false, false, false);
                gl.clear(gl.STENCIL_BUFFER_BIT);
                gl.stencilOp(gl.ZERO, gl.KEEP, gl.INVERT);
                gl.stencilFunc(gl.ALWAYS, 1, 1);
                gl.enable(gl.STENCIL_TEST);

                var buffer = layer.buffer;
                while (buffer <= layer.bufferEnd) {
                    var vertex = tile.lineGeometry.buffers[buffer].vertex;
                    vertex.__proto__ = VertexBuffer.prototype;
                    vertex.bind(gl);

                    var fill = tile.lineGeometry.buffers[buffer].fill;
                    fill.__proto__ = FillBuffer.prototype;
                    fill.bind(gl);

                    var begin = buffer == layer.buffer ? layer.fillIndex : 0;
                    var end = buffer == layer.bufferEnd ? layer.fillIndexEnd : fill.index;
                    gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
                    gl.drawElements(gl.TRIANGLES, (end - begin) * 3, gl.UNSIGNED_SHORT, begin * 6);

                    buffer++;
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

                // Draw the line antialiasing with the stencil.
                if (info.antialias) {
                    gl.stencilFunc(gl.EQUAL, 0x0, 0xff);
                    var width = 0.25;
                    var offset = 0;
                    var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
                    var outset = offset + width / 2 + 0.5;
                    gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
                    gl.uniform2fv(painter.lineShader.u_linewidth, [ outset, inset ]);
                    gl.uniform4fv(painter.lineShader.u_color, info.color);

                    var buffer = layer.buffer;
                    while (buffer <= layer.bufferEnd) {
                        var vertex = tile.lineGeometry.buffers[buffer].vertex;
                        vertex.__proto__ = VertexBuffer.prototype;
                        vertex.bind(gl);
                        gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
                        gl.vertexAttribPointer(painter.lineShader.a_extrude, 2, gl.BYTE, false, 8, 4);

                        var begin = buffer == layer.buffer ? layer.vertexIndex : 0;
                        var count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;
                        gl.drawArrays(gl.TRIANGLE_STRIP, begin, count - begin);

                        buffer++;
                    }
                }
            } else if (info.type == 'line') {
                gl.disable(gl.STENCIL_TEST);
                var width = info.width;
                var offset = 0;
                var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
                var outset = offset + width / 2 + 0.5;
                gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
                gl.uniform2fv(painter.lineShader.u_linewidth, [ outset, inset ]);
                gl.uniform4fv(painter.lineShader.u_color, info.color);

                var buffer = layer.buffer;
                while (buffer <= layer.bufferEnd) {
                    var vertex = tile.lineGeometry.buffers[buffer].vertex;
                    vertex.__proto__ = VertexBuffer.prototype;
                    vertex.bind(gl);
                    gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
                    gl.vertexAttribPointer(painter.lineShader.a_extrude, 2, gl.BYTE, false, 8, 4);

                    var begin = buffer == layer.buffer ? layer.vertexIndex : 0;
                    var count = buffer == layer.bufferEnd ? layer.vertexIndexEnd : vertex.index;
                    gl.drawArrays(gl.TRIANGLE_STRIP, begin, count - begin);

                    buffer++;
                }
            } else {
                for (var i = 0; i < layer.labels.length; i++) {
                    var label = layer.labels[i];
                    labelTexture.drawText('400 200px Helvetica Neue', label.text, label.x, label.y);
                }
            }
        }
    }

    gl.switchShader(this.labelShader, this.posMatrix, this.exMatrix);

    gl.disable(gl.STENCIL_TEST);
    var labelArray = new Int16Array(labelTexture.vertices);

    this.labelBuffer = gl.createBuffer();
    this.bufferProperties.labelItemSize = 2;
    this.bufferProperties.labelNumItems = labelArray.length / this.bufferProperties.labelItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, labelArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.labelShader.a_pos, 2, gl.SHORT, false, 8 /* (4 shorts * 2 bytes/short) */, 0);
    gl.vertexAttribPointer(this.labelShader.a_tex, 2, gl.SHORT, false, 8, 4);


    var labelElementArray = new Int16Array(labelTexture.elements);
    this.labelElementBuffer = gl.createBuffer();
    this.bufferProperties.labelElementItemSize = 1;
    this.bufferProperties.labelElementNumItems = labelElementArray.length / this.bufferProperties.labelElementItemSize;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.labelElementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, labelElementArray, gl.STATIC_DRAW);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, labelTexture.glTexture);
    gl.uniform1i(this.labelShader.u_sampler, 0);

    gl.drawElements(gl.TRIANGLES, labelTexture.elements.length, gl.UNSIGNED_SHORT, 0);

    if (info.debug) {
        gl.switchShader(this.debugShader, painter.posMatrix, painter.exMatrix);
        // draw bounding rectangle
        gl.disable(gl.STENCIL_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
        gl.vertexAttribPointer(this.debugShader.a_pos, this.bufferProperties.debugItemSize, gl.SHORT, false, 0, 0);
        gl.uniform4f(this.debugShader.u_color, 1, 1, 1, 1);
        gl.lineWidth(4);
        gl.drawArrays(gl.LINE_STRIP, 0, this.bufferProperties.debugNumItems);


        // draw tile coordinate
        var coord = info.z + '/' + info.x + '/' + info.y;

        var vertices = textVertices(coord, 50, 200, 5);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
        gl.vertexAttribPointer(this.debugShader.a_pos, this.bufferProperties.textItemSize, gl.SHORT, false, 0, 0);
        gl.lineWidth(4 * devicePixelRatio);
        gl.uniform4f(this.debugShader.u_color, 1, 1, 1, 1);
        gl.drawArrays(gl.LINES, 0, vertices.length / this.bufferProperties.textItemSize);
        gl.lineWidth(2 * devicePixelRatio);
        gl.uniform4f(this.debugShader.u_color, 0, 0, 0, 1);
        gl.drawArrays(gl.LINES, 0, vertices.length / this.bufferProperties.textItemSize);
    }


};
