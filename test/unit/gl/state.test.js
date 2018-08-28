import { test } from 'mapbox-gl-js-test';
import { ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, Program, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArrayOES, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha } from '../../../src/gl/value';
import Context from '../../../src/gl/context';
import Color from '../../../src/style-spec/util/color';
import { deepEqual } from '../../../src/util/util';

const context = new Context(require('gl')(10, 10));

function ValueTest(Constructor, options, t) {
    t.test('#constructor', (t) => {
        const v = new Constructor(context);
        t.ok(v);
        const currentV = v.get();
        t.notEqual(typeof currentV, 'undefined', 'instantiates with a default value');
        t.end();
    });

    t.test('#set', (t) => {
        const v = new Constructor(context);
        v.set(options.setValue);
        const equality = (options.equality) || ((a, b) => deepEqual(a, b));
        t.ok(equality(v.get(), options.setValue));
        t.end();
    });

    t.end();
}

test('ClearColor', ValueTest.bind(ValueTest, ClearColor, {
    setValue: new Color(1, 1, 0, 1)
}));


test('ClearDepth', ValueTest.bind(ValueTest, ClearDepth, {
    setValue: 0.5
}));

test('ClearStencil', ValueTest.bind(ValueTest, ClearStencil, {
    setValue: 0.5
}));

test('ColorMask', ValueTest.bind(ValueTest, ColorMask, {
    setValue: [false, false, true, true]
}));

test('DepthMask', ValueTest.bind(ValueTest, DepthMask, {
    setValue: false
}));

test('StencilMask', ValueTest.bind(ValueTest, StencilMask, {
    setValue: [0x00, 4]
}));

test('StencilFunc', ValueTest.bind(ValueTest, StencilFunc, {
    setValue: {
        func: context.gl.LEQUAL,
        ref: 1,
        mask: 0xFF
    }
}));

test('StencilOp', ValueTest.bind(ValueTest, StencilOp, {
    setValue: [context.gl.KEEP, context.gl.REPLACE, context.gl.REPLACE]
}));

test('StencilTest', ValueTest.bind(ValueTest, StencilTest, {
    setValue: true
}));

test('DepthRange', ValueTest.bind(ValueTest, DepthRange, {
    setValue: [0, 0.1]
}));

test('DepthTest', ValueTest.bind(ValueTest, DepthTest, {
    setValue: true
}));

test('DepthFunc', ValueTest.bind(ValueTest, DepthFunc, {
    setValue: context.gl.EQUAL
}));

test('Blend', ValueTest.bind(ValueTest, Blend, {
    setValue: false
}));

test('BlendFunc', ValueTest.bind(ValueTest, BlendFunc, {
    setValue: [context.gl.SRC_ALPHA, context.gl.SRC_ALPHA]
}));

test('BlendColor', ValueTest.bind(ValueTest, BlendColor, {
    setValue: Color.white
}));

test('Program', ValueTest.bind(ValueTest, Program, {
    equality: (a, b) => a === b,
    setValue: context.gl.createProgram()
}));

test('ActiveTextureUnit', ValueTest.bind(ValueTest, ActiveTextureUnit, {
    setValue: context.gl.TEXTURE1
}));

test('Viewport', ValueTest.bind(ValueTest, Viewport, {
    setValue: [0, 0, 1, 1]
}));

test('BindFramebuffer', ValueTest.bind(ValueTest, BindFramebuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createFramebuffer()
}));

test('BindRenderbuffer', ValueTest.bind(ValueTest, BindRenderbuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createRenderbuffer()
}));

test('BindTexture', ValueTest.bind(ValueTest, BindTexture, {
    equality: (a, b) => a === b,
    setValue: context.gl.createTexture()
}));

test('BindVertexBuffer', ValueTest.bind(ValueTest, BindVertexBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

test('BindElementBuffer', ValueTest.bind(ValueTest, BindElementBuffer, {
    equality: (a, b) => a === b,
    setValue: context.gl.createBuffer()
}));

test('BindVertexArrayOES', ValueTest.bind(ValueTest, BindVertexArrayOES, {
    equality: (a, b) => a === b,
    setValue: context.extVertexArrayObject
}));

test('PixelStoreUnpack', ValueTest.bind(ValueTest, PixelStoreUnpack, {
    setValue: 8
}));

test('PixelStoreUnpackPremultiplyAlpha', ValueTest.bind(ValueTest, PixelStoreUnpackPremultiplyAlpha, {
    setValue: true
}));
