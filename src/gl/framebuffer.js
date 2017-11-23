// @flow
const State = require('./state');
const { ColorAttachment, DepthAttachment } = require('./value');

import type Context from './context';

class Framebuffer {
    context: Context;
    framebuffer: WebGLFramebuffer;
    colorAttachment: State<?WebGLTexture>;
    depthAttachment: State<?WebGLRenderbuffer>;

    constructor(context: Context) {
        this.context = context;
        const gl = context.gl;
        const fbo = this.framebuffer = gl.createFramebuffer();

        this.colorAttachment = new State(new ColorAttachment(context, fbo));
        this.depthAttachment = new State(new DepthAttachment(context, fbo));
    }
}

module.exports = Framebuffer;
