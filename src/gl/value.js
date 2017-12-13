// @flow

const Color = require('../style-spec/util/color');
const util = require('../util/util');

import type Context from './context';
import type {
    BlendFuncType,
    ColorMaskType,
    DepthRangeType,
    DepthMaskType,
    StencilFuncType,
    StencilOpType,
    DepthFuncType,
    TextureUnitType,
    ViewportType,
} from './types';

export interface Value<T> {
    context: Context;
    static default(context?: Context): T;
    set(value: T): void;
    static equal(a: T, b: T): boolean;
}

class ContextValue {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    static equal(a, b): boolean {
        return util.deepEqual(a, b);
    }
}

class ClearColor extends ContextValue implements Value<Color> {
    static default() { return Color.transparent; }

    set(v: Color): void {
        this.context.gl.clearColor(v.r, v.g, v.b, v.a);
    }
}

class ClearDepth extends ContextValue implements Value<number> {
    static default() { return 1; }

    set(v: number): void {
        this.context.gl.clearDepth(v);
    }
}

class ClearStencil extends ContextValue implements Value<number> {
    static default() { return 0; }

    set(v: number): void {
        this.context.gl.clearStencil(v);
    }
}

class ColorMask extends ContextValue implements Value<ColorMaskType> {
    static default() { return [true, true, true, true]; }

    set(v: ColorMaskType): void {
        this.context.gl.colorMask(v[0], v[1], v[2], v[3]);
    }
}

class DepthMask extends ContextValue implements Value<DepthMaskType> {
    static default() { return true; }

    set(v: DepthMaskType): void {
        this.context.gl.depthMask(v);
    }
}

class StencilMask extends ContextValue implements Value<number> {
    static default() { return 0xFF; }

    set(v: number): void {
        this.context.gl.stencilMask(v);
    }
}

class StencilFunc extends ContextValue implements Value<StencilFuncType> {
    static default(context: Context) {
        return {
            func: context.gl.ALWAYS,
            ref: 0,
            mask: 0xFF
        };
    }

    set(v: StencilFuncType): void {
        this.context.gl.stencilFunc(v.func, v.ref, v.mask);
    }
}

class StencilOp extends ContextValue implements Value<StencilOpType> {
    static default(context: Context) {
        const gl = context.gl;
        return [gl.KEEP, gl.KEEP, gl.KEEP];
    }

    set(v: StencilOpType): void {
        this.context.gl.stencilOp(v[0], v[1], v[2]);
    }
}

class StencilTest extends ContextValue implements Value<boolean> {
    static default() { return false; }

    set(v: boolean): void {
        const gl = this.context.gl;
        if (v) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
    }
}

class DepthRange extends ContextValue implements Value<DepthRangeType> {
    static default() { return [0, 1]; }

    set(v: DepthRangeType): void {
        this.context.gl.depthRange(v[0], v[1]);
    }
}

class DepthTest extends ContextValue implements Value<boolean> {
    static default() { return false; }

    set(v: boolean): void {
        const gl = this.context.gl;
        if (v) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    }
}

class DepthFunc extends ContextValue implements Value<DepthFuncType> {
    static default(context: Context) {
        return context.gl.LESS;
    }

    set(v: DepthFuncType): void {
        this.context.gl.depthFunc(v);
    }
}

class Blend extends ContextValue implements Value<boolean> {
    static default() { return false; }

    set(v: boolean): void {
        const gl = this.context.gl;
        if (v) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
    }
}

class BlendFunc extends ContextValue implements Value<BlendFuncType> {
    static default(context: Context) {
        const gl = context.gl;
        return [gl.ONE, gl.ZERO];
    }

    set(v: BlendFuncType): void {
        this.context.gl.blendFunc(v[0], v[1]);
    }
}

class BlendColor extends ContextValue implements Value<Color> {
    static default() { return Color.transparent; }

    set(v: Color): void {
        this.context.gl.blendColor(v.r, v.g, v.b, v.a);
    }
}

class Program extends ContextValue implements Value<?WebGLProgram> {
    static default() { return null; }

    set(v: ?WebGLProgram): void {
        this.context.gl.useProgram(v);
    }

    static equal(a: ?WebGLProgram, b: ?WebGLProgram): boolean {
        return a === b;
    }
}

class LineWidth extends ContextValue implements Value<number> {
    static default() { return 1; }

    set(v: number): void {
        const range = this.context.lineWidthRange;
        this.context.gl.lineWidth(util.clamp(v, range[0], range[1]));
    }
}

class ActiveTextureUnit extends ContextValue implements Value<TextureUnitType> {
    static default(context: Context) {
        return context.gl.TEXTURE0;
    }

    set(v: TextureUnitType): void {
        this.context.gl.activeTexture(v);
    }
}

class Viewport extends ContextValue implements Value<ViewportType> {
    static default(context: Context) {
        const gl = context.gl;
        return [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    }

    set(v: ViewportType): void {
        this.context.gl.viewport(v[0], v[1], v[2], v[3]);
    }
}

class BindFramebuffer extends ContextValue implements Value<?WebGLFramebuffer> {
    static default() { return null; }

    set(v: ?WebGLFramebuffer): void {
        const gl = this.context.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, v);
    }

    static equal(a: ?WebGLFramebuffer, b: ?WebGLFramebuffer): boolean {
        return a === b;
    }
}

class BindRenderbuffer extends ContextValue implements Value<?WebGLRenderbuffer> {
    static default() { return null; }

    set(v: ?WebGLRenderbuffer): void {
        const gl = this.context.gl;
        gl.bindRenderbuffer(gl.RENDERBUFFER, v);
    }

    static equal(a: ?WebGLRenderbuffer, b: ?WebGLRenderbuffer): boolean {
        return a === b;
    }
}

class BindTexture extends ContextValue implements Value<?WebGLTexture> {
    static default() { return null; }

    set(v: ?WebGLTexture): void {
        const gl = this.context.gl;
        gl.bindTexture(gl.TEXTURE_2D, v);
    }

    static equal(a: ?WebGLTexture, b: ?WebGLTexture): boolean {
        return a === b;
    }
}

class BindVertexBuffer extends ContextValue implements Value<?WebGLBuffer> {
    static default() { return null; }

    set(v: ?WebGLBuffer): void {
        const gl = this.context.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, v);
    }

    static equal(a: ?WebGLBuffer, b: ?WebGLBuffer): boolean {
        return a === b;
    }
}

class BindElementBuffer extends ContextValue implements Value<?WebGLBuffer> {
    static default() { return null; }

    set(v: ?WebGLBuffer): void {
        const gl = this.context.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
    }

    static equal(): boolean {
        // Always rebind:
        return false;
    }
}

class BindVertexArrayOES extends ContextValue implements Value<any> {
    static default() { return null; }

    set(v: ?any): void {
        const context = this.context;
        if (context.extVertexArrayObject) {
            context.extVertexArrayObject.bindVertexArrayOES(v);
        }
    }

    static equal(a: any, b: any): boolean {
        return a === b;
    }
}

class PixelStoreUnpack extends ContextValue implements Value<number> {
    static default() { return 4; }

    set(v: number): void {
        const gl = this.context.gl;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, v);
    }
}

class PixelStoreUnpackPremultiplyAlpha extends ContextValue implements Value<boolean> {
    static default() { return false; }

    set(v: boolean): void {
        const gl = this.context.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (v: any));
    }
}

/**
 * Framebuffer values
 */
class FramebufferValue extends ContextValue {
    context: Context;
    parent: WebGLFramebuffer;

    constructor(context: Context, parent: WebGLFramebuffer) {
        super(context);
        this.parent = parent;
    }
}

class ColorAttachment extends FramebufferValue implements Value<?WebGLTexture> {
    static default() { return null; }

    set(v: ?WebGLTexture): void {
        const gl = this.context.gl;
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a renderbuffer to the color
        // attachment point, but thus far MBGL only uses textures for color
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v, 0);
    }

    static equal(a: ?WebGLTexture, b: ?WebGLTexture): boolean {
        return a === b;
    }
}

class DepthAttachment extends FramebufferValue implements Value<?WebGLRenderbuffer> {
    static default() { return null; }

    set(v: ?WebGLRenderbuffer): void {
        const gl = this.context.gl;
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a texture to the depth attachment
        // point, but thus far MBGL only uses renderbuffers for depth
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, v);
    }

    static equal(a: ?WebGLRenderbuffer, b: ?WebGLRenderbuffer): boolean {
        return a === b;
    }
}

module.exports = {
    ClearColor,
    ClearDepth,
    ClearStencil,
    ColorMask,
    DepthMask,
    StencilMask,
    StencilFunc,
    StencilOp,
    StencilTest,
    DepthRange,
    DepthTest,
    DepthFunc,
    Blend,
    BlendFunc,
    BlendColor,
    Program,
    LineWidth,
    ActiveTextureUnit,
    Viewport,
    BindFramebuffer,
    BindRenderbuffer,
    BindTexture,
    BindVertexBuffer,
    BindElementBuffer,
    BindVertexArrayOES,
    PixelStoreUnpack,
    PixelStoreUnpackPremultiplyAlpha,

    ColorAttachment,
    DepthAttachment,
};
