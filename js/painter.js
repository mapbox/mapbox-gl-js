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
    this.pMatrix = mat4.create();
    mat4.ortho(this.pMatrix, 0, width, height, 0, 0, -1);
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

    // Initialize shaders
    this.shader = gl.initializeShader('primitive',
        ['a_pos'],
        ['u_color', 'u_pointsize', 'u_pmatrix', 'u_mvmatrix']);

    this.areaShader = gl.initializeShader('area',
        ['a_pos'],
        ['u_mvmatrix', 'u_pmatrix', 'u_linewidth', 'u_color']);

    this.lineShader = gl.initializeShader('line',
        ['a_pos', 'a_extrude'],
        ['u_mvmatrix', 'u_pmatrix', 'u_linewidth', 'u_color', 'u_debug']);


    this.labelShader = gl.initializeShader('label',
        ['a_pos', 'a_tex'],
        ['u_sampler', 'u_pmatrix', 'u_mvmatrix']);


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
    this.viewMatrix = new Float64Array(16);
    mat4.identity(this.viewMatrix);
    mat4.translate(this.viewMatrix, this.viewMatrix, [ transform.x, transform.y, 0 ]);
    mat4.rotateZ(this.viewMatrix, this.viewMatrix, transform.rotation);
    mat4.translate(this.viewMatrix, this.viewMatrix, [ scale * x, scale * y, 0 ]);
    mat4.scale(this.viewMatrix, this.viewMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);

    // Convert to 32-bit floats after we're done with all the transformations.
    this.viewMatrix = new Float32Array(this.viewMatrix);

    // Update tile stencil buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([ 0, 0, tileExtent, 0, 0, tileExtent, tileExtent, tileExtent ]), gl.STREAM_DRAW);

    // draw depth mask
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    // gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.switchShader(this.shader, this.pMatrix, this.viewMatrix);
    gl.vertexAttribPointer(this.shader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.bufferProperties.tileStencilNumItems);

    // Increase the z depth so that from now on, we are drawing above the z stencil.
    // Note: We need to make a new object identity of the matrix so that shader
    // switches are updating the matrix correctly.
    mat4.translate(this.viewMatrix, this.viewMatrix, [ 0, 0, 1 ]);
    this.viewMatrix = new Float32Array(this.viewMatrix);

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
    gl.switchShader(this.shader, this.pMatrix, this.viewMatrix);

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
            } else if (info.type == 'line') {
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
            } else {
                // console.log(info, layer);
                /*
                for (var i = 0; i < layer.labels.length; i++) {
                    
                }
                */
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.lineElementBuffer);


                gl.lineWidth(10);
                gl.drawElements(gl.LINE_STRIP, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
            }
        }
    }
    
    /*
    var labelTexture = tile.map.labelTexture;
    if (!labelTexture.elements.length) {
        labelTexture.drawText('400 200px Helvetica Neue', 'This is a testing thing', 0, 0);
        //console.log(labelTexture.elements, labelTexture.vertices);
    }

    gl.switchShader(this.labelShader, this.pMatrix, this.viewMatrix);

    var labelArray = new Int16Array(labelTexture.vertices);

    this.labelBuffer = gl.createBuffer();
    this.bufferProperties.labelItemSize = 2;
    this.bufferProperties.labelNumItems = labelArray.length / this.bufferProperties.labelItemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, labelArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.labelShader.a_pos, 2, gl.SHORT, false, 8 /* (4 shorts * 2 bytes/short) * /, 0);
    gl.vertexAttribPointer(this.labelShader.a_tex, 2, gl.SHORT, false, 8, 4);


    var labelElementArray = new Int16Array(labelTexture.elements);
    this.labelElementBuffer = gl.createBuffer();
    this.bufferProperties.labelElementItemSize = 1;
    this.bufferProperties.labelElementNumItems = labelElementArray.length / this.bufferProperties.labelElementItemSize;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.labelElementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, labelElementArray, gl.STATIC_DRAW);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, labelTexture.glTexture);
    gl.uniform1i(this.shader.u_sampler, 0);

    gl.drawElements(gl.TRIANGLES, labelTexture.elements.length, gl.UNSIGNED_SHORT, 0);

    */
    if (info.debug) {
        gl.switchShader(this.shader, this.pMatrix, this.viewMatrix);
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
