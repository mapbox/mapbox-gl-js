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

    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.enable(gl.STENCIL_TEST);


    // Initialize shaders
    this.shader = gl.initializeShader('primitive',
        ['a_pos'],
        ['u_posmatrix', 'u_pointsize', 'u_color']);

    this.areaShader = gl.initializeShader('area',
        ['a_pos'],
        ['u_posmatrix', 'u_linewidth', 'u_color']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_extrude'],
        ['u_posmatrix', 'u_exmatrix', 'u_linewidth', 'u_color', 'u_debug']);

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
    gl.enable(gl.DEPTH_TEST);
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
    gl.switchShader(this.shader, this.posMatrix, this.exMatrix);
    gl.vertexAttribPointer(this.shader.a_pos, 2, gl.SHORT, false, 0, 0);
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
    gl.switchShader(this.shader, painter.posMatrix, painter.exMatrix);
    gl.enable(gl.STENCIL_TEST);

    // register the tile's geometry with the gl context, if it isn't bound yet.
    if (!tile.geometry || !tile.geometry.bind(gl)) {
        return;
    }

    background_color = parse_color('land', style_json.constants);

    // Draw background
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.shader.a_pos, this.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(this.shader.u_color, background_color[0], background_color[1], background_color[2], background_color[3]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.backgroundNumItems);

    // Vertex Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, tile.geometry.vertexBuffer);
    gl.vertexAttribPointer(this.shader.a_pos, tile.geometry.bufferProperties.vertexItemSize, gl.SHORT, false, 0, 0);

    style.forEach(applyStyle);

    function applyStyle(info) {
        var layer = tile.layers[info.data];
        if (layer) {
            // console.log(info.color);
            if (info.type === 'fill') {
                // if (layer.buffer === layer.bufferEnd) {
                //     gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
                //     gl.uniform4fv(painter.areaShader.u_color, info.color);

                //     // First, draw to the stencil buffer, with INVERT on.
                //     gl.clearStencil(0);
                //     gl.colorMask(false, false, false, false);
                //     gl.stencilOp(gl.ZERO, gl.KEEP, gl.INVERT);
                //     gl.stencilFunc(gl.ALWAYS, 1, 1);

                //     var vertex = tile.lineGeometry.buffers[layer.buffer].vertex;
                //     var fill = tile.lineGeometry.buffers[layer.buffer].fill;

                //     vertex.__proto__ = VertexBuffer.prototype;
                //     vertex.bind(gl);
                //     fill.__proto__ = FillBuffer.prototype;
                //     fill.bind(gl);
                //     gl.vertexAttribPointer(painter.areaShader.a_pos, 4, gl.SHORT, false, 8, 0);
                //     // console.warn()
                //     gl.drawElements(gl.TRIANGLES, (layer.fillIndexEnd - layer.fillIndex) * 3, gl.UNSIGNED_SHORT, layer.fillIndex);

                //     // Then, draw the same thing (or a big, tile covering buffer) using the
                //     // stencil we just created.
                //     gl.stencilOp(gl.ZERO, gl.ZERO, gl.KEEP);
                //     gl.colorMask(true, true, true, true);
                //     gl.stencilMask(0xff);
                //     gl.stencilFunc(gl.EQUAL, 0xff, 0xff);

                //     // Set the stencil so that we only draw the outside antialiasing.
                //     gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
                //     gl.vertexAttribPointer(painter.areaShader.a_pos, painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);
                //     gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);

                //     gl.stencilFunc(gl.EQUAL, 0x0, 0xff);


                //     // Draw the new-style rendering:

                //     var width = 0.0;
                //     var offset = 0;
                //     var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
                //     var outset = offset + width / 2 + 0.5;

                //     gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
                //     gl.uniform2fv(painter.lineShader.u_linewidth, [ outset, inset ]);
                //     gl.uniform4fv(painter.lineShader.u_color, info.color);

                //     vertex.bind(gl);
                //     gl.vertexAttribPointer(painter.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
                //     gl.vertexAttribPointer(painter.lineShader.a_extrude, 2, gl.BYTE, false, 8, 4);
                //     gl.drawArrays(gl.TRIANGLE_STRIP, layer.vertexIndex, (layer.vertexIndexEnd - layer.vertexIndex));



                // } else {
                //     // console.warn('TODO: implement buffer-spanning draw calls');
                // }
                gl.switchShader(painter.shader, painter.posMatrix, painter.exMatrix);
                gl.uniform4fv(painter.shader.u_color, info.color);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.fillElementBuffer);
                gl.bindBuffer(gl.ARRAY_BUFFER, tile.geometry.vertexBuffer);
                gl.vertexAttribPointer(painter.shader.a_pos, tile.geometry.bufferProperties.vertexItemSize, gl.SHORT, false, 0, 0);
                gl.drawElements(gl.TRIANGLE_STRIP, layer.fillEnd - layer.fill, gl.UNSIGNED_SHORT, layer.fill * 2);
            } else {
                // // The maximum width supported by most webgl implementations is
                // // 10 - test this for yourself with:
                // // console.log(gl.getParameter( gl.ALIASED_LINE_WIDTH_RANGE));
                // var width = Math.min(10, info.width || 1);
                // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.lineElementBuffer);

                // if (width > 2) {
                //     // wide lines will have gaps in between line segments
                //     // on turns - to fill in the empty space, we draw circles
                //     // at each junction.
                //     gl.uniform1f(painter.shader.u_pointsize, width - 2);
                //     gl.drawElements(gl.POINTS, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
                // }

                // gl.lineWidth(width);
                // gl.drawElements(gl.LINE_STRIP, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);

                // Draw the new-style rendering:

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
            }
        }
    }


    // Draw the new-style rendering:
    // gl.switchShader(this.lineShader, painter.posMatrix, painter.exMatrix;

    // var width = 1;
    // var offset = 0;
    // var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
    // var outset = offset + width / 2 + 0.5;

    // gl.uniform2fv(this.lineShader.u_linewidth, [ outset, inset ]);
    // gl.uniform4fv(this.lineShader.u_color, [ 0, 0, 0, 1 ]);

    // for (var i = 0; i < tile.lineGeometry.buffers.length; i++) {
    //     var vertex = tile.lineGeometry.buffers[i].vertex;
    //     // TODO remove this hack: the prototype is lost during webworker conversion.
    //     vertex.__proto__ = VertexBuffer.prototype;
    //     vertex.bind(gl);
    //     gl.vertexAttribPointer(this.lineShader.a_pos, 4, gl.SHORT, false, 8, 0);
    //     gl.vertexAttribPointer(this.lineShader.a_extrude, 2, gl.BYTE, false, 8, 4);
    //     gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertex.index);
    // }












    if (info.debug) {
        gl.switchShader(this.shader, painter.posMatrix, painter.exMatrix);

        // draw bounding rectangle
        gl.disable(gl.STENCIL_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
        gl.vertexAttribPointer(this.shader.a_pos, this.bufferProperties.debugItemSize, gl.SHORT, false, 0, 0);
        gl.uniform4f(this.shader.u_color, 1, 1, 1, 1);
        gl.lineWidth(4);
        gl.drawArrays(gl.LINE_STRIP, 0, this.bufferProperties.debugNumItems);


        // draw tile coordinate
        var coord = info.z + '/' + info.x + '/' + info.y;

        var vertices = textVertices(coord, 50, 200, 5);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
        gl.vertexAttribPointer(this.shader.a_pos, this.bufferProperties.textItemSize, gl.SHORT, false, 0, 0);
        gl.lineWidth(4 * devicePixelRatio);
        gl.uniform4f(this.shader.u_color, 1, 1, 1, 1);
        gl.drawArrays(gl.LINES, 0, vertices.length / this.bufferProperties.textItemSize);
        gl.lineWidth(2 * devicePixelRatio);
        gl.uniform4f(this.shader.u_color, 0, 0, 0, 1);
        gl.drawArrays(gl.LINES, 0, vertices.length / this.bufferProperties.textItemSize);
    }


};
