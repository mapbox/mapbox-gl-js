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
    current: T;
    default: T;
    dirty: boolean;
    get(): T;
    setDefault(): void;
    set(value: T): void;
}

class BaseValue<T> implements Value<T> {
    gl: WebGLRenderingContext;
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
        if (!this._equals(value) || this.dirty) {
            this._set(value);
            this.current = value;
            this.dirty = false;
        }
    }

    getDefault(): T {
        return this.default; // overriden in child classes
    }
    setDefault() {
        this.set(this.default);
    }
    _equals(value: T): boolean {
        return this.current === value;
    }
    _set(value: T) { // eslint-disable-line
        // overridden in child classes
    }
}

export class ClearColor extends BaseValue<Color> {
    getDefault(): Color {
        return Color.transparent;
    }
    _equals(v: Color): boolean {
        const c = this.current;
        return v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a;
    }
    _set(v: Color) {
        this.gl.clearColor(v.r, v.g, v.b, v.a);
    }
}

export class ClearDepth extends BaseValue<number> {
    getDefault(): number {
        return 1;
    }
    _set(v: number) {
        this.gl.clearDepth(v);
    }
}

export class ClearStencil extends BaseValue<number> {
    getDefault(): number {
        return 0;
    }
    _set(v: number) {
        this.gl.clearStencil(v);
    }
}

export class ColorMask extends BaseValue<ColorMaskType> {
    getDefault(): ColorMaskType {
        return [true, true, true, true];
    }
    _equals(v: ColorMaskType): boolean {
        const c = this.current;
        return v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3];
    }
    _set(v: ColorMaskType) {
        this.gl.colorMask(v[0], v[1], v[2], v[3]);
    }
}

export class DepthMask extends BaseValue<DepthMaskType> {
    getDefault(): DepthMaskType {
        return true;
    }
    _set(v: DepthMaskType): void {
        this.gl.depthMask(v);
    }
}

export class StencilMask extends BaseValue<number> {
    getDefault(): number {
        return 0xFF;
    }
    _set(v: number): void {
        this.gl.stencilMask(v);
    }
}

export class StencilFunc extends BaseValue<StencilFuncType> {
    getDefault(): StencilFuncType {
        return {
            func: this.gl.ALWAYS,
            ref: 0,
            mask: 0xFF
        };
    }
    _equals(v: StencilFuncType): boolean {
        const c = this.current;
        return v.func === c.func && v.ref === c.ref && v.mask === c.mask;
    }
    _set(v: StencilFuncType): void {
        this.gl.stencilFunc(v.func, v.ref, v.mask);
    }
}

export class StencilOp extends BaseValue<StencilOpType> {
    getDefault(): StencilOpType {
        const gl = this.gl;
        return [gl.KEEP, gl.KEEP, gl.KEEP];
    }
    _equals(v: StencilOpType): boolean {
        const c = this.current;
        return v[0] === c[0] && v[1] === c[1] && v[2] === c[2];
    }
    _set(v: StencilOpType) {
        this.gl.stencilOp(v[0], v[1], v[2]);
    }
}

export class StencilTest extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean) {
        const gl = this.gl;
        if (v) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
    }
}

export class DepthRange extends BaseValue<DepthRangeType> {
    getDefault(): DepthRangeType {
        return [0, 1];
    }
    _equals(v: DepthRangeType): boolean {
        const c = this.current;
        return v[0] === c[0] && v[1] === c[1];
    }
    _set(v: DepthRangeType) {
        this.gl.depthRange(v[0], v[1]);
    }
}

export class DepthTest extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean) {
        const gl = this.gl;
        if (v) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    }
}

export class DepthFunc extends BaseValue<DepthFuncType> {
    getDefault(): DepthFuncType {
        return this.gl.LESS;
    }
    _set(v: DepthFuncType) {
        this.gl.depthFunc(v);
    }
}

export class Blend extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean) {
        const gl = this.gl;
        if (v) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
    }
}

export class BlendFunc extends BaseValue<BlendFuncType> {
    getDefault(): BlendFuncType {
        const gl = this.gl;
        return [gl.ONE, gl.ZERO];
    }
    _equals(v: BlendFuncType): boolean {
        const c = this.current;
        return v[0] === c[0] && v[1] === c[1];
    }
    _set(v: BlendFuncType) {
        this.gl.blendFunc(v[0], v[1]);
    }
}

export class BlendColor extends BaseValue<Color> {
    getDefault(): Color {
        return Color.transparent;
    }
    _equals(v: Color): boolean {
        const c = this.current;
        return  v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a;
    }
    _set(v: Color) {
        this.gl.blendColor(v.r, v.g, v.b, v.a);
    }
}

export class BlendEquation extends BaseValue<BlendEquationType> {
    getDefault(): BlendEquationType {
        return this.gl.FUNC_ADD;
    }
    _set(v: BlendEquationType) {
        this.gl.blendEquation(v);
    }
}

export class CullFace extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean) {
        const gl = this.gl;
        if (v) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }
    }
}

export class CullFaceSide extends BaseValue<CullFaceModeType> {
    getDefault(): CullFaceModeType {
        return this.gl.BACK;
    }
    _set(v: CullFaceModeType) {
        this.gl.cullFace(v);
    }
}

export class FrontFace extends BaseValue<FrontFaceType> {
    getDefault(): FrontFaceType {
        return this.gl.CCW;
    }
    _set(v: FrontFaceType) {
        this.gl.frontFace(v);
    }
}

export class Program extends BaseValue<?WebGLProgram> {
    getDefault(): WebGLProgram {
        return null;
    }
    _set(v: ?WebGLProgram) {
        this.gl.useProgram(v);
    }
}

export class ActiveTextureUnit extends BaseValue<TextureUnitType> {
    getDefault(): TextureUnitType {
        return this.gl.TEXTURE0;
    }
    _set(v: TextureUnitType) {
        this.gl.activeTexture(v);
    }
}

export class Viewport extends BaseValue<ViewportType> {
    getDefault(): ViewportType {
        const gl = this.gl;
        return [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    }
    _equals(v: ViewportType): boolean {
        const c = this.current;
        return v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3];
    }
    _set(v: ViewportType) {
        this.gl.viewport(v[0], v[1], v[2], v[3]);
    }
}

export class BindFramebuffer extends BaseValue<?WebGLFramebuffer> {
    getDefault(): WebGLFramebuffer {
        return null;
    }
    _set(v: ?WebGLFramebuffer) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, v);
    }
}

export class BindRenderbuffer extends BaseValue<?WebGLRenderbuffer> {
    getDefault(): WebGLRenderbuffer {
        return null;
    }
    _set(v: ?WebGLRenderbuffer) {
        const gl = this.gl;
        gl.bindRenderbuffer(gl.RENDERBUFFER, v);
    }
}

export class BindTexture extends BaseValue<?WebGLTexture> {
    getDefault(): WebGLTexture {
        return null;
    }
    _set(v: ?WebGLTexture) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, v);
    }
}

export class BindVertexBuffer extends BaseValue<?WebGLBuffer> {
    getDefault(): WebGLBuffer {
        return null;
    }
    _set(v: ?WebGLBuffer) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, v);
    }
}

export class BindElementBuffer extends BaseValue<?WebGLBuffer> {
    getDefault(): WebGLBuffer {
        return null;
    }
    set(v: ?WebGLBuffer) {
        // Always rebind
        const gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindVertexArrayOES extends BaseValue<any> {
    vao: any;

    constructor(context: Context) {
        super(context);
        this.vao = context.extVertexArrayObject;
    }
    getDefault(): any {
        return null;
    }
    _set(v: any) {
        if (this.vao) {
            this.vao.bindVertexArrayOES(v);
        }
    }
}

export class PixelStoreUnpack extends BaseValue<number> {
    getDefault(): number {
        return 4;
    }
    _set(v: number) {
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, v);
    }
}

export class PixelStoreUnpackPremultiplyAlpha extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean): void {
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (v: any));
    }
}

export class PixelStoreUnpackFlipY extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    _set(v: boolean): void {
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, (v: any));
    }
}

class FramebufferAttachment<T> extends BaseValue<?T> {
    parent: WebGLFramebuffer;
    context: Context;

    constructor(context: Context, parent: WebGLFramebuffer) {
        super(context);
        this.context = context;
        this.parent = parent;
    }
    getDefault() {
        return null;
    }
}

export class ColorAttachment extends FramebufferAttachment<WebGLTexture> {
    setDirty() {
        this.dirty = true;
    }
    _set(v: ?WebGLTexture): void {
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a renderbuffer to the color
        // attachment point, but thus far MBGL only uses textures for color
        const gl = this.gl;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v, 0);
    }
}

export class DepthAttachment extends FramebufferAttachment<WebGLRenderbuffer> {
    _set(v: ?WebGLRenderbuffer): void {
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a texture to the depth attachment
        // point, but thus far MBGL only uses renderbuffers for depth
        const gl = this.gl;
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, v);
    }
}
