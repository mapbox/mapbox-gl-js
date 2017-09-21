// @flow

import type VertexBuffer from '../gl/vertex_buffer';
import type VertexArrayObject from './vertex_array_object';

import type Painter from './painter';

class RenderTexture {
    gl: WebGLRenderingContext;
    texture: WebGLTexture;
    fbo: WebGLFramebuffer;
    buffer: VertexBuffer;
    vao: VertexArrayObject;
    attachedRbo: ?WebGLRenderbuffer;

    constructor(painter: Painter) {
        const gl = this.gl = painter.gl;

        const texture = this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width, painter.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, null);

        const fbo = this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }

    bindWithDepth(depthRbo: WebGLRenderbuffer) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        if (this.attachedRbo !== depthRbo) {
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRbo);
            this.attachedRbo = depthRbo;
        }
    }

    unbind() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}

module.exports = RenderTexture;
