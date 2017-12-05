// @flow
const State = require('./state');
const { ColorAttachment, DepthAttachment } = require('./value');

import type Context from './context';

class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment: State<?WebGLTexture>;
    depthAttachment: State<?WebGLRenderbuffer>;

    constructor(context: Context, width: number, height: number) {
        this.context = context;
        this.width = width;
        this.height = height;
        const gl = context.gl;
        const fbo = this.framebuffer = gl.createFramebuffer();

        this.colorAttachment = new State(new ColorAttachment(context, fbo));
        this.depthAttachment = new State(new DepthAttachment(context, fbo));
    }

    destroy() {
        const gl = this.context.gl;

        const texture = this.colorAttachment.get();
        if (texture) gl.deleteTexture(texture);

        const renderbuffer = this.depthAttachment.get();
        if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);

        gl.deleteFramebuffer(this.framebuffer);
    }
}

module.exports = Framebuffer;
