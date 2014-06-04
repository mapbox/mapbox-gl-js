'use strict';

module.exports = PrerenderedTexture;

function PrerenderedTexture(gl, bucket) {
    this.gl = gl;
    this.size = bucket['prerender-size'] || 1024;
    this.buffer = bucket['prerender-buffer'] || (1/32);

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
