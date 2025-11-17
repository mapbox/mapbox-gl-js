import {ColorAttachment, DepthRenderbufferAttachment, DepthTextureAttachment} from './value';
import assert from 'assert';

import type Context from './context';
import type {DepthBufferType} from './types';

class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment0: ColorAttachment;
    colorAttachment1: ColorAttachment;
    depthAttachment: DepthRenderbufferAttachment | DepthTextureAttachment;
    depthAttachmentType: DepthBufferType | null | undefined;

    constructor(context: Context, width: number, height: number, numColorAttachments: number, depthType?: DepthBufferType | null) {
        this.context = context;
        this.width = width;
        this.height = height;
        const gl = context.gl;
        const fbo = this.framebuffer = (gl.createFramebuffer());

        assert(numColorAttachments <= 2);

        if (numColorAttachments > 0) {
            this.colorAttachment0 = new ColorAttachment(context, fbo, 0);
        }
        if (numColorAttachments > 1) {
            this.colorAttachment1 = new ColorAttachment(context, fbo, 1);
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

    createColorAttachment(context: Context, idx: number) {
        if (idx === 0) {
            this.colorAttachment0 = new ColorAttachment(context, this.framebuffer, 0);
        } else if (idx === 1) {
            this.colorAttachment1 = new ColorAttachment(context, this.framebuffer, 1);
        }
    }

    removeColorAttachment(context: Context, idx: number) {
        const gl = this.context.gl;

        let texture: WebGLTexture;
        if (idx === 0) {
            texture = this.colorAttachment0.get();
            this.colorAttachment0 = undefined;
        } else if (idx === 1) {
            texture = this.colorAttachment1.get();
            this.colorAttachment1 = undefined;
        }
        if (texture) gl.deleteTexture(texture);
    }

    destroy() {
        const gl = this.context.gl;

        if (this.colorAttachment0) {
            const texture = this.colorAttachment0.get();
            if (texture) gl.deleteTexture(texture);
        }

        if (this.colorAttachment1) {
            const texture = this.colorAttachment1.get();
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
