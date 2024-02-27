import {expect, test, describe} from '../../util/vitest.js';
import {ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, Program, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArrayOES, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha} from '../../../src/gl/value.js';
import Context from '../../../src/gl/context.js';
import Color from '../../../src/style-spec/util/color.js';
import {deepEqual} from '../../../src/util/util.js';

const el = window.document.createElement('canvas');
const gl = el.getContext('webgl2');
const context = new Context(gl);

function ValueTest(Constructor, options) {
    test('#constructor', () => {
        const v = new Constructor(context);
        expect(v).toBeTruthy();
        const currentV = v.get();
        expect(typeof currentV).not.toBe('undefined');  // instantiates with a default value
    });

    test('#set', () => {
        const v = new Constructor(context);
        v.set(options.setValue);
        const equality = (options.equality) || ((a, b) => deepEqual(a, b));
        expect(equality(v.get(), options.setValue)).toBeTruthy();
    });
}

describe('ClearColor', ValueTest.bind(ValueTest, ClearColor, {
    setValue: new Color(1, 1, 0, 1)
}));

describe('ClearDepth', ValueTest.bind(ValueTest, ClearDepth, {
    setValue: 0.5
}));

describe('ClearStencil', ValueTest.bind(ValueTest, ClearStencil, {
    setValue: 0.5
}));

describe('ColorMask', ValueTest.bind(ValueTest, ColorMask, {
    setValue: [false, false, true, true]
}));

describe('DepthMask', ValueTest.bind(ValueTest, DepthMask, {
    setValue: false
}));

describe('StencilMask', ValueTest.bind(ValueTest, StencilMask, {
    setValue: [0x00, 4]
}));

describe('StencilFunc', ValueTest.bind(ValueTest, StencilFunc, {
    setValue: {
        func: context.gl.LEQUAL,
        ref: 1,
        mask: 0xFF
    }
}));

describe('StencilOp', ValueTest.bind(ValueTest, StencilOp, {
    setValue: [context.gl.KEEP, context.gl.REPLACE, context.gl.REPLACE]
}));

describe('StencilTest', ValueTest.bind(ValueTest, StencilTest, {
    setValue: true
}));

describe('DepthRange', ValueTest.bind(ValueTest, DepthRange, {
    setValue: [0, 0.1]
}));

describe('DepthTest', ValueTest.bind(ValueTest, DepthTest, {
    setValue: true
}));

describe('DepthFunc', ValueTest.bind(ValueTest, DepthFunc, {
    setValue: context.gl.EQUAL
}));

describe('Blend', ValueTest.bind(ValueTest, Blend, {
    setValue: false
}));

describe('BlendFunc', ValueTest.bind(ValueTest, BlendFunc, {
    setValue: [context.gl.SRC_ALPHA, context.gl.SRC_ALPHA]
}));

describe('BlendColor', ValueTest.bind(ValueTest, BlendColor, {
    setValue: Color.white
}));

describe('Program', ValueTest.bind(ValueTest, Program, {
    equality: (a, b) => a === b,
    setValue: context.gl.createProgram()
}));

describe('ActiveTextureUnit', ValueTest.bind(ValueTest, ActiveTextureUnit, {
    setValue: context.gl.TEXTURE1
}));

describe('Viewport', ValueTest.bind(ValueTest, Viewport, {
    setValue: [0, 0, 1, 1]
}));

describe('BindFramebuffer', ValueTest.bind(ValueTest, BindFramebuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createFramebuffer()
}));

describe('BindRenderbuffer', ValueTest.bind(ValueTest, BindRenderbuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createRenderbuffer()
}));

describe('BindTexture', ValueTest.bind(ValueTest, BindTexture, {
    equality: (a, b) => a === b,
    setValue: context.gl.createTexture()
}));

describe('BindVertexBuffer', ValueTest.bind(ValueTest, BindVertexBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

describe('BindElementBuffer', ValueTest.bind(ValueTest, BindElementBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

describe('BindVertexArrayOES', ValueTest.bind(ValueTest, BindVertexArrayOES, {
    equality: (a, b) => a === b,
    setValue: context.extVertexArrayObject
}));

describe('PixelStoreUnpack', ValueTest.bind(ValueTest, PixelStoreUnpack, {
    setValue: 8
}));

describe('PixelStoreUnpackPremultiplyAlpha', ValueTest.bind(ValueTest, PixelStoreUnpackPremultiplyAlpha, {
    setValue: true
}));
