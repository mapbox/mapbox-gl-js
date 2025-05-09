import Color, {type NonPremultipliedRenderColor} from '../style-spec/util/color';
import assert from 'assert';

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
    current: T;
    default: T;
    dirty: boolean;
    get: () => T;
    setDefault: () => void;
    set: (value: T) => void;
}

class BaseValue<T> implements Value<T> {
    gl: WebGL2RenderingContext;
    current: T;
    default: T;
    dirty: boolean;

    constructor(context: Context) {
        this.gl = context.gl;
        this.default = this.getDefault();
        this.current = this.default;
        this.dirty = false;
    }

    get(): T {
        return this.current;
    }

    set(value: T) {
        // overridden in child classes;
    }

    getDefault(): T {
        return this.default; // overriden in child classes
    }

    setDefault() {
        this.set(this.default);
    }
}

export class ClearColor extends BaseValue<NonPremultipliedRenderColor> {
    override getDefault(): NonPremultipliedRenderColor {
        return Color.transparent.toNonPremultipliedRenderColor(null);
    }

    override set(v: NonPremultipliedRenderColor) {
        const c = this.current;
        if (v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a && !this.dirty) return;
        this.gl.clearColor(v.r, v.g, v.b, v.a);
        this.current = v;
        this.dirty = false;
    }
}

export class ClearDepth extends BaseValue<number> {
    override getDefault(): number {
        return 1;
    }

    override set(v: number) {
        if (v === this.current && !this.dirty) return;
        this.gl.clearDepth(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ClearStencil extends BaseValue<number> {
    override getDefault(): number {
        return 0;
    }

    override set(v: number) {
        if (v === this.current && !this.dirty) return;
        this.gl.clearStencil(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ColorMask extends BaseValue<ColorMaskType> {
    override getDefault(): ColorMaskType {
        return [true, true, true, true];
    }

    override set(v: ColorMaskType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3] && !this.dirty) return;
        this.gl.colorMask(v[0], v[1], v[2], v[3]);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthMask extends BaseValue<DepthMaskType> {
    override getDefault(): DepthMaskType {
        return true;
    }

    override set(v: DepthMaskType): void {
        if (v === this.current && !this.dirty) return;
        this.gl.depthMask(v);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilMask extends BaseValue<number> {
    override getDefault(): number {
        return 0xFF;
    }

    override set(v: number): void {
        if (v === this.current && !this.dirty) return;
        this.gl.stencilMask(v);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilFunc extends BaseValue<StencilFuncType> {
    override getDefault(): StencilFuncType {
        return {
            func: this.gl.ALWAYS,
            ref: 0,
            mask: 0xFF
        };
    }

    override set(v: StencilFuncType): void {
        const c = this.current;
        if (v.func === c.func && v.ref === c.ref && v.mask === c.mask && !this.dirty) return;
        // Assume UNSIGNED_INT_24_8 storage, with 8 bits dedicated to stencil.
        // Please revise your stencil values if this threshold is triggered.
        assert(v.ref >= 0 && v.ref <= 255);
        this.gl.stencilFunc(v.func, v.ref, v.mask);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilOp extends BaseValue<StencilOpType> {
    override getDefault(): StencilOpType {
        const gl = this.gl;
        return [gl.KEEP, gl.KEEP, gl.KEEP];
    }

    override set(v: StencilOpType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && !this.dirty) return;
        this.gl.stencilOp(v[0], v[1], v[2]);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilTest extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class DepthRange extends BaseValue<DepthRangeType> {
    override getDefault(): DepthRangeType {
        return [0, 1];
    }

    override set(v: DepthRangeType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && !this.dirty) return;
        this.gl.depthRange(v[0], v[1]);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthTest extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class DepthFunc extends BaseValue<DepthFuncType> {
    override getDefault(): DepthFuncType {
        return this.gl.LESS;
    }

    override set(v: DepthFuncType) {
        if (v === this.current && !this.dirty) return;
        this.gl.depthFunc(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Blend extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class BlendFunc extends BaseValue<BlendFuncType> {
    override getDefault(): BlendFuncType {
        const gl = this.gl;
        return [gl.ONE, gl.ZERO, gl.ONE, gl.ZERO];
    }

    override set(v: BlendFuncType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3] && !this.dirty) return;
        this.gl.blendFuncSeparate(v[0], v[1], v[2], v[3]);
        this.current = v;
        this.dirty = false;
    }
}

export class BlendColor extends BaseValue<NonPremultipliedRenderColor> {
    override getDefault(): NonPremultipliedRenderColor {
        return Color.transparent.toNonPremultipliedRenderColor(null);
    }

    override set(v: NonPremultipliedRenderColor) {
        const c = this.current;
        if (v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a && !this.dirty) return;
        this.gl.blendColor(v.r, v.g, v.b, v.a);
        this.current = v;
        this.dirty = false;
    }
}

export class BlendEquation extends BaseValue<BlendEquationType> {
    override getDefault(): BlendEquationType {
        return this.gl.FUNC_ADD;
    }

    override set(v: BlendEquationType) {
        if (v === this.current && !this.dirty) return;
        this.gl.blendEquationSeparate(v, v);
        this.current = v;
        this.dirty = false;
    }
}

export class CullFace extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class CullFaceSide extends BaseValue<CullFaceModeType> {
    override getDefault(): CullFaceModeType {
        return this.gl.BACK;
    }

    override set(v: CullFaceModeType) {
        if (v === this.current && !this.dirty) return;
        this.gl.cullFace(v);
        this.current = v;
        this.dirty = false;
    }
}

export class FrontFace extends BaseValue<FrontFaceType> {
    override getDefault(): FrontFaceType {
        return this.gl.CCW;
    }

    override set(v: FrontFaceType) {
        if (v === this.current && !this.dirty) return;
        this.gl.frontFace(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Program extends BaseValue<WebGLProgram | null | undefined> {
    override getDefault(): WebGLProgram | null {
        return null;
    }

    override set(v?: WebGLProgram | null) {
        if (v === this.current && !this.dirty) return;
        this.gl.useProgram(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ActiveTextureUnit extends BaseValue<TextureUnitType> {
    override getDefault(): TextureUnitType {
        return this.gl.TEXTURE0;
    }

    override set(v: TextureUnitType) {
        if (v === this.current && !this.dirty) return;
        this.gl.activeTexture(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Viewport extends BaseValue<ViewportType> {
    override getDefault(): ViewportType {
        const gl = this.gl;
        return [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    }

    override set(v: ViewportType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3] && !this.dirty) return;
        this.gl.viewport(v[0], v[1], v[2], v[3]);
        this.current = v;
        this.dirty = false;
    }
}

export class BindFramebuffer extends BaseValue<WebGLFramebuffer | null | undefined> {
    override getDefault(): WebGLFramebuffer | null {
        return null;
    }

    override set(v?: WebGLFramebuffer | null) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindRenderbuffer extends BaseValue<WebGLRenderbuffer | null | undefined> {
    override getDefault(): WebGLRenderbuffer | null {
        return null;
    }

    override set(v?: WebGLRenderbuffer | null) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindRenderbuffer(gl.RENDERBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindTexture extends BaseValue<WebGLTexture | null | undefined> {
    override getDefault(): WebGLTexture | null {
        return null;
    }

    override set(v?: WebGLTexture | null) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindVertexBuffer extends BaseValue<WebGLBuffer | null | undefined> {
    override getDefault(): WebGLBuffer | null {
        return null;
    }

    override set(v?: WebGLBuffer | null) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindElementBuffer extends BaseValue<WebGLBuffer | null | undefined> {
    override getDefault(): WebGLBuffer | null {
        return null;
    }

    override set(v?: WebGLBuffer | null) {
        // Always rebind
        const gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BindVertexArrayOES extends BaseValue<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override getDefault(): any {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override set(v: any) {
        if (!this.gl || (v === this.current && !this.dirty)) return;
        this.gl.bindVertexArray(v);
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpack extends BaseValue<number> {
    override getDefault(): number {
        return 4;
    }

    override set(v: number) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, v);
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpackPremultiplyAlpha extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean): void {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, v);
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpackFlipY extends BaseValue<boolean> {
    override getDefault(): boolean {
        return false;
    }

    override set(v: boolean): void {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, v);
        this.current = v;
        this.dirty = false;
    }
}

class FramebufferAttachment<T> extends BaseValue<T | null | undefined> {
    parent: WebGLFramebuffer;
    context: Context;

    constructor(context: Context, parent: WebGLFramebuffer) {
        super(context);
        this.context = context;
        this.parent = parent;
    }
    override getDefault(): null {
        return null;
    }
}

export class ColorAttachment extends FramebufferAttachment<WebGLTexture> {
    setDirty() {
        this.dirty = true;
    }

    override set(v?: WebGLTexture | null): void {
        if (v === this.current && !this.dirty) return;
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a renderbuffer to the color
        // attachment point, but thus far MBGL only uses textures for color
        const gl = this.gl;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v, 0);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthRenderbufferAttachment extends FramebufferAttachment<WebGLRenderbuffer> {
    attachment(): number { return this.gl.DEPTH_ATTACHMENT; }
    override set(v: WebGLRenderbuffer | null | undefined | WebGLTexture): void {
        if (v === this.current && !this.dirty) return;
        this.context.bindFramebuffer.set(this.parent);
        const gl = this.gl;
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, this.attachment(), gl.RENDERBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthTextureAttachment extends FramebufferAttachment<WebGLTexture> {
    attachment(): number { return this.gl.DEPTH_ATTACHMENT; }
    override set(v?: WebGLTexture | null): void {
        if (v === this.current && !this.dirty) return;
        this.context.bindFramebuffer.set(this.parent);
        const gl = this.gl;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, this.attachment(), gl.TEXTURE_2D, v, 0);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthStencilAttachment extends DepthRenderbufferAttachment {
    override attachment(): number { return this.gl.DEPTH_STENCIL_ATTACHMENT; }
}
