'use strict';

const test = require('mapbox-gl-js-test').test;
const State = require('../../../src/gl/state');
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
    PixelStoreUnpackPremultiplyAlpha
} = require('../../../src/gl/value');
const Context = require('../../../src/gl/context');
const Color = require('../../../src/style-spec/util/color');

const context = new Context(require('gl')(10, 10));

function ValueTest(Constructor, options, t) {
    t.test('#constructor', (t) => {
        const v = new State(new Constructor(context));
        t.ok(v);
        const currentV = v.get();
        const defaultV = v.value.constructor.default(context);
        t.notEqual(typeof currentV, 'undefined');
        t.notEqual(typeof defaultV, 'undefined');
        t.ok(v.value.constructor.equal(currentV, defaultV) ||
            // special case for BindElementBuffer, where equal always returns false
            currentV === defaultV);
        t.end();
    });

    t.test('#set', (t) => {
        const v = new State(new Constructor(context));
        v.set(options.setValue);
        t.ok(v.value.constructor.equal(v.get(), options.setValue) ||
            // special case for BindElementBuffer, where equal always returns false
            v.get() === options.setValue);
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
    setValue: context.gl.createProgram()
}));

test('LineWidth', ValueTest.bind(ValueTest, LineWidth, {
    setValue: 0.5
}));

test('ActiveTextureUnit', ValueTest.bind(ValueTest, ActiveTextureUnit, {
    setValue: context.gl.TEXTURE1
}));

test('Viewport', ValueTest.bind(ValueTest, Viewport, {
    setValue: [0, 0, 1, 1]
}));

test('BindFramebuffer', ValueTest.bind(ValueTest, BindFramebuffer, {
    setValue: context.gl.createFramebuffer()
}));

test('BindRenderbuffer', ValueTest.bind(ValueTest, BindRenderbuffer, {
    setValue: context.gl.createRenderbuffer()
}));

test('BindTexture', ValueTest.bind(ValueTest, BindTexture, {
    setValue: context.gl.createTexture()
}));

test('BindVertexBuffer', ValueTest.bind(ValueTest, BindVertexBuffer, {
    setValue: context.gl.createBuffer()
}));

test('BindElementBuffer', ValueTest.bind(ValueTest, BindElementBuffer, {
    setValue: context.gl.createBuffer()
}));

test('BindVertexArrayOES', ValueTest.bind(ValueTest, BindVertexArrayOES, {
    setValue: context.extVertexArrayObject
}));

test('PixelStoreUnpack', ValueTest.bind(ValueTest, PixelStoreUnpack, {
    setValue: 8
}));

test('PixelStoreUnpackPremultiplyAlpha', ValueTest.bind(ValueTest, PixelStoreUnpackPremultiplyAlpha, {
    setValue: true
}));
