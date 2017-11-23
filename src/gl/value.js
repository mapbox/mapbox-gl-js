// @flow

import type Context from './context';
import type {
    BlendFuncType,
    ColorMaskType,
    DepthRangeType,
    StencilFuncType,
    StencilOpType,
    DepthFuncType,
    TextureUnitType,
    ViewportType,
} from './types';
const Color = require('../style-spec/util/color');

export interface Value<T> {
    context: Context;
    static default(context?: Context): T;
    set(value: T): void;
}

class ContextValue {
    context: Context;

    constructor(context: Context) {
        this.context = context;
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

class DepthMask extends ContextValue implements Value<boolean> {
    static default() { return true; }

    set(v: boolean): void {
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
    static default() { return true; }

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
}

class LineWidth extends ContextValue implements Value<number> {
    static default() { return 1; }

    set(v: number): void {
        this.context.gl.lineWidth(v);
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
}

class BindRenderbuffer extends ContextValue implements Value<?WebGLRenderbuffer> {
    static default() { return null; }

    set(v: ?WebGLRenderbuffer): void {
        const gl = this.context.gl;
        gl.bindRenderbuffer(gl.RENDERBUFFER, v);
    }
}

class BindTexture extends ContextValue implements Value<?WebGLTexture> {
    static default() { return null; }

    set(v: ?WebGLTexture): void {
        const gl = this.context.gl;
        gl.bindTexture(gl.TEXTURE_2D, v);
    }
}

class BindVertexBuffer extends ContextValue implements Value<?WebGLBuffer> {
    static default() { return null; }

    set(v: ?WebGLBuffer): void {
        const gl = this.context.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, v);
    }
}

class BindElementBuffer extends ContextValue implements Value<?WebGLBuffer> {
    static default() { return null; }

    set(v: ?WebGLBuffer): void {
        const gl = this.context.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
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
    // VertexAttribute,
    PixelStoreUnpack,
    PixelStoreUnpackPremultiplyAlpha,
};
