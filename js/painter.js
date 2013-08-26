

function GLPainter(gl) {
    this.gl = gl;
    this.width = this.gl.canvas.offsetWidth;
    this.height = this.gl.canvas.offsetHeight;
    this.setup();
}

GLPainter.prototype.setup = function() {
    var gl = this.gl;
    if (DEBUG) console.time('GLPainter#setup');

    gl.verbose = true;

    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    // Initialize model view matrix
    this.mvMatrix = mat4.create();
    mat4.identity(this.mvMatrix);
    mat4.translate(this.mvMatrix, [0, 0, -1]);

    // Initialize projection matrix
    this.pMatrix = mat4.create();
    mat4.ortho(0, this.width, this.height, 0, 0, -1, this.pMatrix);

    // Initialize shaders
    var fragmentShader = gl.getShader("fragment");
    var vertexShader = gl.getShader("vertex");

    var shader = this.shader = gl.createProgram();
    gl.attachShader(shader, vertexShader);
    gl.attachShader(shader, fragmentShader);
    gl.linkProgram(shader);

    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(shader));
        alert("Could not initialize shaders");
    }

    gl.useProgram(shader);

    // Shader attributes
    this.position = gl.getAttribLocation(shader, "a_position");
    gl.enableVertexAttribArray(this.position);

    this.color = gl.getUniformLocation(shader, "uColor");
    this.pointSize = gl.getUniformLocation(shader, "uPointSize");
    this.projection = gl.getUniformLocation(shader, "uPMatrix");
    this.modelView = gl.getUniformLocation(shader, "uMVMatrix");


    gl.uniformMatrix4fv(this.projection, false, this.pMatrix);
    gl.uniformMatrix4fv(this.modelView, false, this.mvMatrix);

    var background = [ -32768, -32768, 32766, -32768, -32768, 32766, 32766, 32766 ];
    var backgroundArray = new Int16Array(background);
    this.backgroundBuffer = gl.createBuffer();
    this.backgroundBuffer.itemSize = 2;
    this.backgroundBuffer.numItems = background.length / this.backgroundBuffer.itemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundArray, gl.STATIC_DRAW);


    var debug = [ 0, 0, /**/ 4095, 0, /**/ 4095, 4095, /**/ 0, 4095, /**/ 0, 0];
    var debugArray = new Int16Array(debug);
    this.debugBuffer = gl.createBuffer();
    this.debugBuffer.itemSize = 2;
    this.debugBuffer.numItems = debug.length / this.debugBuffer.itemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, debugArray, gl.STATIC_DRAW);

    // tile stencil buffer
    var tileStencilBuffer = this.tileStencilBuffer = gl.createBuffer();
    tileStencilBuffer.itemSize = 2;
    tileStencilBuffer.numItems = 4;


    gl.enable(gl.DEPTH_TEST);


    if (DEBUG) console.timeEnd('GLPainter#setup');
};

GLPainter.prototype.clear = function() {
    var gl = this.gl;
    gl.clearColor(0.9, 0.9, 0.9, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
};

GLPainter.prototype.viewport = function(z, x, y, transform, tileSize, pixelRatio) {
    var gl = this.gl;
    var tileExtent = 4096;

    // Initialize model-view matrix that converts from the tile coordinates
    // to screen coordinates.
    var tileScale = Math.pow(2, z);
    var scale = transform.scale * tileSize / tileScale;
    var viewMatrix = mat4.create();
    mat4.identity(viewMatrix);
    mat4.translate(viewMatrix, [ transform.x + scale * x, transform.y + scale * y, 0 ]);
    mat4.scale(viewMatrix, [ scale / tileExtent, scale / tileExtent, 1 ]);
    mat4.rotateZ(viewMatrix, transform.rotation);
    gl.uniformMatrix4fv(this.modelView, false, viewMatrix);

    // console.warn(viewMatrix);

    // Update tile stencil buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array([ 0, 0, tileExtent, 0, 0, tileExtent, tileExtent, tileExtent ]), gl.STREAM_DRAW);

    // draw depth mask
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // gl.colorMask(false, false, false, false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tileStencilBuffer);
    gl.vertexAttribPointer(this.position, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileStencilBuffer.numItems);


    mat4.translate(viewMatrix, [ 0, 0, 1 ]);
    gl.uniformMatrix4fv(this.modelView, false, viewMatrix);


    // draw actual tile
    gl.depthFunc(gl.GREATER);
    gl.depthMask(false);
    gl.colorMask(true, true, true, true);

};

GLPainter.prototype.draw = function(tile, style) {
    var painter = this;
    var gl = this.gl;

    // register the tile's geometry with the gl context, if it isn't bound yet.
    if (!tile.geometry.bind(gl)) {
        return;
    }

    // Draw background
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.vertexAttribPointer(this.position, this.backgroundBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(this.color, 0.9098, 0.8784, 0.8471, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.backgroundBuffer.numItems);

    // Vertex Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, tile.geometry.vertexBuffer);
    gl.vertexAttribPointer(this.position, tile.geometry.vertexBuffer.itemSize, gl.SHORT, false, 0, 0);

    style.forEach(applyStyle);

    function applyStyle(info) {
        var layer = tile.layers[info.data];
        if (layer) {
            gl.uniform4fv(painter.color, info.color);
            if (info.type === 'fill') {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.fillElementBuffer);
                gl.drawElements(gl.TRIANGLE_STRIP, layer.fillEnd - layer.fill, gl.UNSIGNED_SHORT, layer.fill * 2);
            } else {
                var width = Math.min(10, info.width || 1);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.geometry.lineElementBuffer);

                if (width > 2) {
                    gl.uniform1f(painter.pointSize, width - 2);
                    gl.drawElements(gl.POINTS, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
                }

                gl.lineWidth(width);
                gl.drawElements(gl.LINE_STRIP, layer.lineEnd - layer.line, gl.UNSIGNED_SHORT, layer.line * 2);
            }
        }
    }

    // gl.bindBuffer(gl.ARRAY_BUFFER, this.debugBuffer);
    // gl.vertexAttribPointer(this.position, this.debugBuffer.itemSize, gl.SHORT, false, 0, 0);
    // gl.uniform4f(this.color, 1, 1, 1, 1);
    // gl.lineWidth(4);
    // gl.drawArrays(gl.LINE_STRIP, 0, this.debugBuffer.numItems);
};
