'use strict';

var glmatrix = require('../lib/glmatrix.js');
var mat4 = glmatrix.mat4;

module.exports = PrerenderedTexture;

function PrerenderedTexture(gl, bucket) {
    this.gl = gl;
    this.buffer = bucket['raster-buffer'] || (1/32);
    this.size = (bucket['raster-size'] || 512) * (1 + 2 * this.buffer);

    this.texture = null;
    this.fbo = null;
    this.fboPrevious = null;
}

PrerenderedTexture.prototype.bindFramebuffer = function() {
    var gl = this.gl;
    // TODO get previous fbo

    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    if (!this.fbo) {
        var stencil = this.stencilBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, this.size, this.size);

        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    }
};

PrerenderedTexture.prototype.unbindFramebuffer = function() {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboPrevious);
    gl.deleteFramebuffer(this.fbo);
};

PrerenderedTexture.prototype.bind = function() {
    if (!this.texture) throw('pre-rendered texture does not exist');
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
};

PrerenderedTexture.prototype.blur = function(painter, passes) {
    var gl = this.gl;
    var originalTexture = this.texture;
    var secondaryTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, secondaryTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size, this.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    var matrix = mat4.create();
    mat4.ortho(matrix, 0, 4096, -4096, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -4096, 0]);

    gl.switchShader(painter.gaussianShader, matrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(painter.gaussianShader.u_image, 0);
    gl.uniform1f(painter.gaussianShader.u_opacity, 1);

    for (var i = 0; i < passes; i++) {

        // Render horizontal
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, secondaryTexture, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2fv(painter.gaussianShader.u_offset, [1 / this.size, 0]);
        gl.bindTexture(gl.TEXTURE_2D, originalTexture);
        gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
        gl.vertexAttribPointer(painter.gaussianShader.a_pos, 2, gl.SHORT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);


        // Render vertical
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, originalTexture, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2fv(painter.gaussianShader.u_offset, [0, 1 / this.size]);
        gl.bindTexture(gl.TEXTURE_2D, secondaryTexture);
        gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
        gl.vertexAttribPointer(painter.gaussianShader.a_pos, 2, gl.SHORT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.deleteTexture(secondaryTexture);
};
