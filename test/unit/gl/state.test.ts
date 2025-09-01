// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {expect, test, describe} from '../../util/vitest';
import {ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, Program, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArrayOES, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha} from '../../../src/gl/value';
import Context from '../../../src/gl/context';
import Color from '../../../src/style-spec/util/color';
import {deepEqual} from '../../../src/util/util';

const el = window.document.createElement('canvas');
const gl = el.getContext('webgl2');
const context = new Context(gl);

function ValueTest(Constructor, options) {
    test('#constructor', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const v = new Constructor(context);
        expect(v).toBeTruthy();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const currentV = v.get();
        expect(typeof currentV).not.toBe('undefined');  // instantiates with a default value
    });

    test('#set', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const v = new Constructor(context);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        v.set(options.setValue);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const equality = (options.equality) || ((a, b) => (deepEqual(a, b)));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(equality(v.get(), options.setValue)).toBeTruthy();
    });
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('ClearColor', ValueTest.bind(ValueTest, ClearColor, {
    setValue: new Color(1, 1, 0, 1)
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('ClearDepth', ValueTest.bind(ValueTest, ClearDepth, {
    setValue: 0.5
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('ClearStencil', ValueTest.bind(ValueTest, ClearStencil, {
    setValue: 0.5
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('ColorMask', ValueTest.bind(ValueTest, ColorMask, {
    setValue: [false, false, true, true]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('DepthMask', ValueTest.bind(ValueTest, DepthMask, {
    setValue: false
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('StencilMask', ValueTest.bind(ValueTest, StencilMask, {
    setValue: [0x00, 4]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('StencilFunc', ValueTest.bind(ValueTest, StencilFunc, {
    setValue: {
        func: context.gl.LEQUAL,
        ref: 1,
        mask: 0xFF
    }
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('StencilOp', ValueTest.bind(ValueTest, StencilOp, {
    setValue: [context.gl.KEEP, context.gl.REPLACE, context.gl.REPLACE]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('StencilTest', ValueTest.bind(ValueTest, StencilTest, {
    setValue: true
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('DepthRange', ValueTest.bind(ValueTest, DepthRange, {
    setValue: [0, 0.1]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('DepthTest', ValueTest.bind(ValueTest, DepthTest, {
    setValue: true
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('DepthFunc', ValueTest.bind(ValueTest, DepthFunc, {
    setValue: context.gl.EQUAL
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('Blend', ValueTest.bind(ValueTest, Blend, {
    setValue: false
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BlendFunc', ValueTest.bind(ValueTest, BlendFunc, {
    setValue: [context.gl.SRC_ALPHA, context.gl.SRC_ALPHA]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BlendColor', ValueTest.bind(ValueTest, BlendColor, {
    setValue: Color.white
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('Program', ValueTest.bind(ValueTest, Program, {
    equality: (a, b) => a === b,
    setValue: context.gl.createProgram()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('ActiveTextureUnit', ValueTest.bind(ValueTest, ActiveTextureUnit, {
    setValue: context.gl.TEXTURE1
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('Viewport', ValueTest.bind(ValueTest, Viewport, {
    setValue: [0, 0, 1, 1]
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindFramebuffer', ValueTest.bind(ValueTest, BindFramebuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createFramebuffer()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindRenderbuffer', ValueTest.bind(ValueTest, BindRenderbuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createRenderbuffer()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindTexture', ValueTest.bind(ValueTest, BindTexture, {
    equality: (a, b) => a === b,
    setValue: context.gl.createTexture()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindVertexBuffer', ValueTest.bind(ValueTest, BindVertexBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindElementBuffer', ValueTest.bind(ValueTest, BindElementBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('BindVertexArrayOES', ValueTest.bind(ValueTest, BindVertexArrayOES, {
    equality: (a, b) => a === b,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    setValue: context.extVertexArrayObject
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('PixelStoreUnpack', ValueTest.bind(ValueTest, PixelStoreUnpack, {
    setValue: 8
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
describe('PixelStoreUnpackPremultiplyAlpha', ValueTest.bind(ValueTest, PixelStoreUnpackPremultiplyAlpha, {
    setValue: true
}));
