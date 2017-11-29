// @flow
const IndexBuffer = require('./index_buffer');
const VertexBuffer = require('./vertex_buffer');
const Framebuffer = require('./framebuffer');
const State = require('./state');
const DepthMode = require('./depth_mode');
const StencilMode = require('./stencil_mode');
const ColorMode = require('./color_mode');
const util = require('../util/util');
const {
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
} = require('./value');


import type {TriangleIndexArray, LineIndexArray} from '../data/index_array_type';
import type {
    StructArray,
    StructArrayMember
} from '../util/struct_array';
import type {
    BlendFuncType,
    ColorMaskType,
    DepthRangeType,
    StencilFuncType,
    DepthFuncType,
    StencilOpType,
    TextureUnitType,
    ViewportType,
} from './types';
import type Color from '../style-spec/util/color';

type ClearArgs = {
    color?: Color,
    depth?: number,
    stencil?: number
};


class Context {
    gl: WebGLRenderingContext;
    extVertexArrayObject: any;
    currentNumAttributes: ?number;
    lineWidthRange: [number, number];

    clearColor: State<Color>;
    clearDepth: State<number>;
    clearStencil: State<number>;
    colorMask: State<ColorMaskType>;
    depthMask: State<boolean>;
    stencilMask: State<number>;
    stencilFunc: State<StencilFuncType>;
    stencilOp: State<StencilOpType>;
    stencilTest: State<boolean>;
    depthRange: State<DepthRangeType>;
    depthTest: State<boolean>;
    depthFunc: State<DepthFuncType>;
    blend: State<boolean>;
    blendFunc: State<BlendFuncType>;
    blendColor: State<Color>;
    program: State<?WebGLProgram>;
    lineWidth: State<number>;
    activeTexture: State<TextureUnitType>;
    viewport: State<ViewportType>;
    bindFramebuffer: State<?WebGLFramebuffer>;
    bindRenderbuffer: State<?WebGLRenderbuffer>
    bindTexture: State<?WebGLTexture>;
    bindVertexBuffer: State<?WebGLBuffer>;
    bindElementBuffer: State<?WebGLBuffer>;
    bindVertexArrayOES: State<any>;
    pixelStoreUnpack: State<number>;
    pixelStoreUnpackPremultiplyAlpha: State<boolean>;

    extTextureFilterAnisotropic: any;
    extTextureFilterAnisotropicMax: any;
    extTextureHalfFloat: any;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.extVertexArrayObject = this.gl.getExtension('OES_vertex_array_object');
        this.lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);

        this.clearColor = new State(new ClearColor(this));
        this.clearDepth = new State(new ClearDepth(this));
        this.clearStencil = new State(new ClearStencil(this));
        this.colorMask = new State(new ColorMask(this));
        this.depthMask = new State(new DepthMask(this));
        this.stencilMask = new State(new StencilMask(this));
        this.stencilFunc = new State(new StencilFunc(this));
        this.stencilOp = new State(new StencilOp(this));
        this.stencilTest = new State(new StencilTest(this));
        this.depthRange = new State(new DepthRange(this));
        this.depthTest = new State(new DepthTest(this));
        this.depthFunc = new State(new DepthFunc(this));
        this.blend = new State(new Blend(this));
        this.blendFunc = new State(new BlendFunc(this));
        this.blendColor = new State(new BlendColor(this));
        this.program = new State(new Program(this));
        this.lineWidth = new State(new LineWidth(this));
        this.activeTexture = new State(new ActiveTextureUnit(this));
        this.viewport = new State(new Viewport(this));
        this.bindFramebuffer = new State(new BindFramebuffer(this));
        this.bindRenderbuffer = new State(new BindRenderbuffer(this));
        this.bindTexture = new State(new BindTexture(this));
        this.bindVertexBuffer = new State(new BindVertexBuffer(this));
        this.bindElementBuffer = new State(new BindElementBuffer(this));
        this.bindVertexArrayOES = this.extVertexArrayObject && new State(new BindVertexArrayOES(this));
        this.pixelStoreUnpack = new State(new PixelStoreUnpack(this));
        this.pixelStoreUnpackPremultiplyAlpha = new State(new PixelStoreUnpackPremultiplyAlpha(this));

        this.extTextureFilterAnisotropic = (
            gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
        );
        if (this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        }

        this.extTextureHalfFloat = gl.getExtension('OES_texture_half_float');
        if (this.extTextureHalfFloat) {
            gl.getExtension('OES_texture_half_float_linear');
        }

    }

    createIndexBuffer(array: TriangleIndexArray | LineIndexArray, dynamicDraw?: boolean) {
        return new IndexBuffer(this, array, dynamicDraw);
    }

    createVertexBuffer(array: StructArray, attributes: $ReadOnlyArray<StructArrayMember>, dynamicDraw?: boolean) {
        return new VertexBuffer(this, array, attributes, dynamicDraw);
    }

    createRenderbuffer(storageFormat: number, width: number, height: number) {
        const gl = this.gl;

        const rbo = gl.createRenderbuffer();
        this.bindRenderbuffer.set(rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, storageFormat, width, height);
        this.bindRenderbuffer.set(null);

        return rbo;
    }

    createFramebuffer(width: number, height: number) {
        return new Framebuffer(this, width, height);
    }

    clear({color, depth}: ClearArgs) {
        const gl = this.gl;
        let mask = 0;

        if (color) {
            mask |= gl.COLOR_BUFFER_BIT;
            this.clearColor.set(color);
            this.colorMask.set([true, true, true, true]);
        }

        if (typeof depth !== 'undefined') {
            mask |= gl.DEPTH_BUFFER_BIT;
            this.clearDepth.set(depth);
            this.depthMask.set(true);
        }

        // See note in Painter#clearStencil: implement this the easy way once GPU bug/workaround is fixed upstream
        // if (typeof stencil !== 'undefined') {
        //     mask |= gl.STENCIL_BUFFER_BIT;
        //     this.clearStencil.set(stencil);
        //     this.stencilMask.set(0xFF);
        // }

        gl.clear(mask);
    }

    setDepthMode(depthMode: DepthMode) {
        if (depthMode.func === this.gl.ALWAYS && !depthMode.mask) {
            this.depthTest.set(false);
        } else {
            this.depthTest.set(true);
            this.depthFunc.set(depthMode.func);
            this.depthMask.set(depthMode.mask);
            this.depthRange.set(depthMode.range);
        }
    }

    setStencilMode(stencilMode: StencilMode) {
        if (stencilMode.func === this.gl.ALWAYS && !stencilMode.mask) {
            this.stencilTest.set(false);
        } else {
            this.stencilTest.set(true);
            this.stencilMask.set(stencilMode.mask);
            this.stencilOp.set([stencilMode.fail, stencilMode.depthFail, stencilMode.pass]);
            this.stencilFunc.set({
                func: stencilMode.test.func,
                ref: stencilMode.ref,
                mask: stencilMode.test.mask
            });
        }
    }

    setColorMode(colorMode: ColorMode) {
        if (util.deepEqual(colorMode.blendFunction, ColorMode.Replace)) {
            this.blend.set(false);
        } else {
            this.blend.set(true);
            this.blendFunc.set(colorMode.blendFunction);
            this.blendColor.set(colorMode.blendColor);
        }

        this.colorMask.set(colorMode.mask);
    }
}

module.exports = Context;
