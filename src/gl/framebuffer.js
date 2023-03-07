// @flow
import {ColorAttachment, DepthRenderbufferAttachment, DepthTextureAttachment} from './value.js';

import type Context from './context.js';
import type {DepthBufferType} from './types.js';

class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment: ColorAttachment;
    depthAttachment: DepthRenderbufferAttachment | DepthTextureAttachment;
    depthAttachmentType: ?DepthBufferType

    constructor(context: Context, width: number, height: number, hasColor: boolean, depthType: ?DepthBufferType) {
        this.context = context;
        this.width = width;
        this.height = height;
        const gl = context.gl;
        const fbo = this.framebuffer = ((gl.createFramebuffer(): any): WebGLFramebuffer);

        if (hasColor) {
            this.colorAttachment = new ColorAttachment(context, fbo);
        }
        if (depthType) {
            this.depthAttachmentType = depthType;

            if (depthType === 'renderbuffer') {
                this.depthAttachment = new DepthRenderbufferAttachment(context, fbo);
            } else {
                this.depthAttachment = new DepthTextureAttachment(context, fbo);
            }
        }
    }

    destroy() {
        const gl = this.context.gl;

        if (this.colorAttachment) {
            const texture = this.colorAttachment.get();
            if (texture) gl.deleteTexture(texture);
        }

        if (this.depthAttachment && this.depthAttachmentType) {
            if (this.depthAttachmentType === 'renderbuffer') {
                const renderbuffer = this.depthAttachment.get();
                if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);
            } else {
                const texture = this.depthAttachment.get();
                if (texture) gl.deleteTexture(texture);
            }
        }

        gl.deleteFramebuffer(this.framebuffer);
    }
}

export default Framebuffer;
