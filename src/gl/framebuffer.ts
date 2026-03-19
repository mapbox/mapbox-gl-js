import {ColorAttachment, DepthRenderbufferAttachment, DepthTextureAttachment} from './value';
import Texture from '../render/texture';
import assert from 'assert';

import type Context from './context';
import type {DepthBufferType} from './types';
import type {TextureFormat} from '../render/texture';

class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment0: ColorAttachment;
    colorAttachment1: ColorAttachment;
    depthAttachment: DepthRenderbufferAttachment | DepthTextureAttachment;
    depthAttachmentType: DepthBufferType | null | undefined;
    _stencilRbo: WebGLRenderbuffer | null | undefined;

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

    static createWithTexture(
        context: Context,
        existingFbo: Framebuffer | null,
        width: number,
        height: number,
        attachStencil?: boolean
    ): Framebuffer {
        const gl = context.gl;

        context.activeTexture.set(gl.TEXTURE1);
        context.viewport.set([0, 0, width, height]);

        if (existingFbo && existingFbo.width === width && existingFbo.height === height) {
            gl.bindTexture(gl.TEXTURE_2D, existingFbo.colorAttachment0.get());
            context.bindFramebuffer.set(existingFbo.framebuffer);
            return existingFbo;
        }

        if (existingFbo) {
            existingFbo.destroy();
        }

        const format: TextureFormat = context.extRenderToTextureHalfFloat ? context.gl.RGBA16F : context.gl.RGBA8;
        const texture = new Texture(context, {width, height, data: null}, format);
        texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        const fbo = context.createFramebuffer(width, height, 1, null);
        fbo.colorAttachment0.set(texture.texture);

        if (attachStencil) {
            const stencilRbo = context.createRenderbuffer(gl.DEPTH24_STENCIL8, width, height);
            context.bindFramebuffer.set(fbo.framebuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencilRbo);
            fbo._stencilRbo = stencilRbo;
        }

        return fbo;
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

        if (this._stencilRbo) {
            gl.deleteRenderbuffer(this._stencilRbo);
            this._stencilRbo = null;
        }

        gl.deleteFramebuffer(this.framebuffer);
    }
}

export default Framebuffer;
