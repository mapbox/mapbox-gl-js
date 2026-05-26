export function createTexture(gl) {
    const vsSource = `
    attribute vec2 aPosition;
    void main(void) {
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
    `;

    const fsSource = `
    precision mediump float;
    void main(void) {
        vec2 resolution = vec2(400.0, 400.0);
        vec2 uv = gl_FragCoord.xy / resolution;
        gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0); // Red color
    }
    `;

    const shaderProgram = createProgram(gl, vsSource, fsSource);
    gl.useProgram(shaderProgram);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const vertices = new Float32Array([
        1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0,

        -1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(shaderProgram, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const textureWidth = 400;
    const textureHeight = 400;
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.viewport(0, 0, textureWidth, textureHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.deleteBuffer(vertexBuffer);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteProgram(shaderProgram);

    return texture;
}

export function createShader(gl, src, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const message = gl.getShaderInfoLog(shader);
    if (message.length > 0) {
        console.error(message);
    }
    return shader;
};

export function createProgram(gl, vert, frag) {
    var vertShader = createShader(gl, vert, gl.VERTEX_SHADER);
    var fragShader = createShader(gl, frag, gl.FRAGMENT_SHADER);

    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.validateProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        console.error(`Could not compile WebGL program. \n\n${info}`);
    }

    return program;
};
