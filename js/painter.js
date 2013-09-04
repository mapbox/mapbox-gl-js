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
    var pMatrix = mat4.create();
    mat4.ortho(pMatrix, 0, width, height, 0, 0, -1);
    gl.uniformMatrix4fv(this.shader.u_pmatrix, false, pMatrix);
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

    // // Initialize shaders
    this.shader = gl.initializeShader('primitive',
        ['a_pos'],
        ['u_color', 'u_pointsize', 'u_pmatrix', 'u_mvmatrix']);
    gl.switchShader(this.shader);

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
    var viewMatrix = new Float64Array(16);
    mat4.identity(viewMatrix);
    mat4.translate(viewMatrix, viewMatrix, [ transform.x, transform.y, 0 ]);
    mat4.rotateZ(viewMatrix, viewMatrix, transform.rotation);
    mat4.translate(viewMatrix, viewMatrix, [ scale * x, scale * y, 0 ]);
    mat4.scale(viewMatrix, viewMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);

    // Convert to 32-bit floats after we're done with all the transformations.
    viewMatrix = new Float32Array(viewMatrix);

    gl.uniformMatrix4fv(this.shader.u_mvmatrix, false, viewMatrix);

    // Update tile stencil buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([ 0, 0, tileExtent, 0, 0, tileExtent, tileExtent, tileExtent ]), gl.STREAM_DRAW);

    // draw depth mask
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    // gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.vertexAttribPointer(this.shader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.tileStencilNumItems);


    mat4.translate(viewMatrix, viewMatrix, [ 0, 0, 1 ]);
    gl.uniformMatrix4fv(this.shader.u_mvmatrix, false, viewMatrix);


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
            gl.uniform4fv(painter.shader.u_color, info.color);
            if (info.type === 'fill') {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.fillElementBuffer);
                gl.drawElements(gl.TRIANGLE_STRIP, layer.fillEnd - layer.fill, gl.UNSIGNED_SHORT, layer.fill * 2);
            } else {
                // The maximum width supported by most webgl implementations is
                // 10 - test this for yourself with:
                // console.log(gl.getParameter( gl.ALIASED_LINE_WIDTH_RANGE));
                var width = Math.min(10, info.width || 1);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.lineElementBuffer);

                if (width > 2) {
                    // wide lines will have gaps in between line segments
                    // on turns - to fill in the empty space, we draw circles
                    // at each junction.
                    gl.uniform1f(painter.shader.u_pointsize, width - 2);
                    gl.drawElements(gl.POINTS, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
                }

                gl.lineWidth(width);
                gl.drawElements(gl.LINE_STRIP, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
            }
        }
    }

    if (info.debug) {
        // draw bounding rectangle
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
