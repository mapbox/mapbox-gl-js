// @flow

import Color from '../style-spec/util/color';

import type Context from './context';
import type {
    BlendFuncType,
    BlendEquationType,
    ColorMaskType,
    DepthRangeType,
    DepthMaskType,
    StencilFuncType,
    StencilOpType,
    DepthFuncType,
    TextureUnitType,
    ViewportType,
    CullFaceModeType,
    FrontFaceType,
} from './types';

export interface Value<T> {
    context: Context;
    current: T;
    default: T;
    dirty: boolean;
    get(): T;
    setDefault(): void;
    set(value: T): void;
}

export class ClearColor implements Value<Color> {
    context: Context;
    current: Color;
    default: Color;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = Color.transparent;
        this.current = this.default;
        this.dirty = false;
    }

    get(): Color { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: Color): void {
        const c = this.current;
        if (v.r !== c.r || v.g !== c.g || v.b !== c.b || v.a !== c.a || this.dirty === true) {
            this.context.gl.clearColor(v.r, v.g, v.b, v.a);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class ClearDepth implements Value<number> {
    context: Context;
    current: number;
    default: number;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = 1;
        this.current = this.default;
        this.dirty = false;
    }

    get(): number { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: number): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.clearDepth(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class ClearStencil implements Value<number> {
    context: Context;
    current: number;
    default: number;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = 0;
        this.current = this.default;
        this.dirty = false;
    }

    get(): number { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: number): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.clearStencil(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class ColorMask implements Value<ColorMaskType> {
    context: Context;
    current: ColorMaskType;
    default: ColorMaskType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = [true, true, true, true];
        this.current = this.default;
        this.dirty = false;
    }

    get(): ColorMaskType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ColorMaskType): void {
        const c = this.current;
        if (v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2] || v[3] !== c[3] || this.dirty === true) {
            this.context.gl.colorMask(v[0], v[1], v[2], v[3]);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class DepthMask implements Value<DepthMaskType> {
    context: Context;
    current: DepthMaskType;
    default: DepthMaskType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = true;
        this.current = this.default;
        this.dirty = false;
    }

    get(): DepthMaskType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: DepthMaskType): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.depthMask(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class StencilMask implements Value<number> {
    context: Context;
    current: number;
    default: number;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = 0xFF;
        this.current = this.default;
        this.dirty = false;
    }

    get(): number { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: number): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.stencilMask(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class StencilFunc implements Value<StencilFuncType> {
    context: Context;
    current: StencilFuncType;
    default: StencilFuncType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = {
            func: context.gl.ALWAYS,
            ref: 0,
            mask: 0xFF
        };
        this.current = this.default;
        this.dirty = false;
    }

    get(): StencilFuncType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: StencilFuncType): void {
        const c = this.current;
        if (v.func !== c.func || v.ref !== c.ref || v.mask !== c.mask || this.dirty === true) {
            this.context.gl.stencilFunc(v.func, v.ref, v.mask);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class StencilOp implements Value<StencilOpType> {
    context: Context;
    current: StencilOpType;
    default: StencilOpType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = this.context.gl;
        this.default = [gl.KEEP, gl.KEEP, gl.KEEP];
        this.current = this.default;
        this.dirty = false;
    }

    get(): StencilOpType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: StencilOpType): void {
        const c = this.current;
        if (v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2] || this.dirty === true) {
            this.context.gl.stencilOp(v[0], v[1], v[2]);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class StencilTest implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            if (v) {
                gl.enable(gl.STENCIL_TEST);
            } else {
                gl.disable(gl.STENCIL_TEST);
            }
            this.current = v;
            this.dirty = false;
        }
    }
}

export class DepthRange implements Value<DepthRangeType> {
    context: Context;
    current: DepthRangeType;
    default: DepthRangeType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = [0, 1];
        this.current = this.default;
        this.dirty = false;
    }

    get(): DepthRangeType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: DepthRangeType): void {
        const c = this.current;
        if (v[0] !== c[0] || v[1] !== c[1] || this.dirty === true) {
            this.context.gl.depthRange(v[0], v[1]);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class DepthTest implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            if (v) {
                gl.enable(gl.DEPTH_TEST);
            } else {
                gl.disable(gl.DEPTH_TEST);
            }
            this.current = v;
            this.dirty = false;
        }
    }
}

export class DepthFunc implements Value<DepthFuncType> {
    context: Context;
    current: DepthFuncType;
    default: DepthFuncType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = context.gl.LESS;
        this.current = this.default;
        this.dirty = false;
    }

    get(): DepthFuncType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: DepthFuncType): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.depthFunc(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class Blend implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            if (v) {
                gl.enable(gl.BLEND);
            } else {
                gl.disable(gl.BLEND);
            }
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BlendFunc implements Value<BlendFuncType> {
    context: Context;
    current: BlendFuncType;
    default: BlendFuncType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = this.context.gl;
        this.default = [gl.ONE, gl.ZERO];
        this.current = this.default;
        this.dirty = false;
    }

    get(): BlendFuncType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: BlendFuncType): void {
        const c = this.current;
        if (v[0] !== c[0] || v[1] !== c[1] || this.dirty === true) {
            this.context.gl.blendFunc(v[0], v[1]);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BlendColor implements Value<Color> {
    context: Context;
    current: Color;
    default: Color;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = Color.transparent;
        this.current = this.default;
        this.dirty = false;
    }

    get(): Color { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: Color): void {
        const c = this.current;
        if (v.r !== c.r || v.g !== c.g || v.b !== c.b || v.a !== c.a || this.dirty === true) {
            this.context.gl.blendColor(v.r, v.g, v.b, v.a);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BlendEquation implements Value<BlendEquationType> {
    context: Context;
    current: BlendEquationType;
    default: BlendEquationType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = this.context.gl.FUNC_ADD;
        this.current = this.default;
        this.dirty = false;
    }

    get(): BlendEquationType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: BlendEquationType): void {
        if (v !== this.current || this.dirty === true) {
            this.context.gl.blendEquation(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class CullFace implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            if (v) {
                gl.enable(gl.CULL_FACE);
            } else {
                gl.disable(gl.CULL_FACE);
            }
            this.current = v;
            this.dirty = false;
        }
    }
}

export class CullFaceSide implements Value<CullFaceModeType> {
    context: Context;
    current: CullFaceModeType;
    default: CullFaceModeType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = this.context.gl;
        this.default = gl.BACK;
        this.current = this.default;
        this.dirty = false;
    }

    get(): CullFaceModeType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: CullFaceModeType): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.cullFace(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class FrontFace implements Value<FrontFaceType> {
    context: Context;
    current: FrontFaceType;
    default: FrontFaceType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = this.context.gl;
        this.default = gl.CCW;
        this.current = this.default;
        this.dirty = false;
    }

    get(): FrontFaceType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: FrontFaceType): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.frontFace(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class Program implements Value<?WebGLProgram> {
    context: Context;
    current: ?WebGLProgram;
    default: ?WebGLProgram;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLProgram { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLProgram): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.useProgram(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class ActiveTextureUnit implements Value<TextureUnitType> {
    context: Context;
    current: TextureUnitType;
    default: TextureUnitType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = context.gl.TEXTURE0;
        this.current = this.default;
        this.dirty = false;
    }

    get(): TextureUnitType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: TextureUnitType): void {
        if (this.current !== v || this.dirty === true) {
            this.context.gl.activeTexture(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class Viewport implements Value<ViewportType> {
    context: Context;
    current: ViewportType;
    default: ViewportType;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        const gl = this.context.gl;
        this.default = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
        this.current = this.default;
        this.dirty = false;
    }

    get(): ViewportType { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ViewportType): void {
        const c = this.current;
        if (v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2] || v[3] !== c[3] || this.dirty === true) {
            this.context.gl.viewport(v[0], v[1], v[2], v[3]);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BindFramebuffer implements Value<?WebGLFramebuffer> {
    context: Context;
    current: ?WebGLFramebuffer;
    default: ?WebGLFramebuffer;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLFramebuffer { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLFramebuffer): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BindRenderbuffer implements Value<?WebGLRenderbuffer> {
    context: Context;
    current: ?WebGLRenderbuffer;
    default: ?WebGLRenderbuffer;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLRenderbuffer { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLRenderbuffer): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.bindRenderbuffer(gl.RENDERBUFFER, v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BindTexture implements Value<?WebGLTexture> {
    context: Context;
    current: ?WebGLTexture;
    default: ?WebGLTexture;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLTexture { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLTexture): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.bindTexture(gl.TEXTURE_2D, v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BindVertexBuffer implements Value<?WebGLBuffer> {
    context: Context;
    current: ?WebGLBuffer;
    default: ?WebGLBuffer;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLBuffer { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLBuffer): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class BindElementBuffer implements Value<?WebGLBuffer> {
    context: Context;
    current: ?WebGLBuffer;
    default: ?WebGLBuffer;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): ?WebGLBuffer { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLBuffer): void {
        // Always rebind
        const gl = this.context.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindVertexArrayOES implements Value<any> {
    context: Context;
    current: any;
    default: any;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
    }

    get(): any { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: any): void {
        if (this.current !== v && this.context.extVertexArrayObject || this.dirty === true) {
            this.context.extVertexArrayObject.bindVertexArrayOES(v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class PixelStoreUnpack implements Value<number> {
    context: Context;
    current: number;
    default: number;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = 4;
        this.current = this.default;
        this.dirty = false;
    }

    get(): number { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: number): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, v);
            this.current = v;
            this.dirty = false;
        }
    }
}

export class PixelStoreUnpackPremultiplyAlpha implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (v: any));
            this.current = v;
            this.dirty = false;
        }
    }
}

export class PixelStoreUnpackFlipY implements Value<boolean> {
    context: Context;
    current: boolean;
    default: boolean;
    dirty: boolean;

    constructor(context: Context) {
        this.context = context;
        this.default = false;
        this.current = this.default;
        this.dirty = false;
    }

    get(): boolean { return this.current; }

    setDefault(): void { this.set(this.default); }

    set(v: boolean): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, (v: any));
            this.current = v;
            this.dirty = false;
        }
    }
}

/**
 * Framebuffer values
 * @private
 */
export class FramebufferValue<T> {
    context: Context;
    parent: WebGLFramebuffer;
    current: ?T;
    default: ?T;
    dirty: boolean;

    constructor(context: Context, parent: WebGLFramebuffer) {
        this.context = context;
        this.default = null;
        this.current = this.default;
        this.dirty = false;
        this.parent = parent;
    }

    get(): ?T { return this.current; }
}

export class ColorAttachment extends FramebufferValue<?WebGLTexture> implements Value<?WebGLTexture> {
    dirty: boolean;

    constructor(context: Context, parent: WebGLFramebuffer) {
        super(context, parent);
        this.dirty = false;
    }

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLTexture): void {
        if (this.dirty || this.current !== v) {
            const gl = this.context.gl;
            this.context.bindFramebuffer.set(this.parent);
            // note: it's possible to attach a renderbuffer to the color
            // attachment point, but thus far MBGL only uses textures for color
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v, 0);
            this.current = v;
            this.dirty = false;
        }
    }

    setDirty() {
        this.dirty = true;
    }
}

export class DepthAttachment extends FramebufferValue<?WebGLRenderbuffer> implements Value<?WebGLRenderbuffer> {

    setDefault(): void { this.set(this.default); }

    set(v: ?WebGLRenderbuffer): void {
        if (this.current !== v || this.dirty === true) {
            const gl = this.context.gl;
            this.context.bindFramebuffer.set(this.parent);
            // note: it's possible to attach a texture to the depth attachment
            // point, but thus far MBGL only uses renderbuffers for depth
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, v);
            this.current = v;
            this.dirty = false;
        }
    }
}
