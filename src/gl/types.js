// @flow

type BlendFuncConstant =
    | $PropertyType<WebGL2RenderingContext, 'ZERO'>
    | $PropertyType<WebGL2RenderingContext, 'ONE'>
    | $PropertyType<WebGL2RenderingContext, 'SRC_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_SRC_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'DST_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_DST_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'SRC_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_SRC_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'DST_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_DST_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'CONSTANT_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_CONSTANT_COLOR'>
    | $PropertyType<WebGL2RenderingContext, 'CONSTANT_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'ONE_MINUS_CONSTANT_ALPHA'>
    | $PropertyType<WebGL2RenderingContext, 'BLEND_COLOR'>;

export type BlendFuncType = [BlendFuncConstant, BlendFuncConstant, BlendFuncConstant, BlendFuncConstant];

export type BlendEquationType =
    | $PropertyType<WebGL2RenderingContext, 'FUNC_ADD'>
    | $PropertyType<WebGL2RenderingContext, 'FUNC_SUBTRACT'>
    | $PropertyType<WebGL2RenderingContext, 'FUNC_REVERSE_SUBTRACT'>;

export type ColorMaskType = [boolean, boolean, boolean, boolean];

export type CompareFuncType =
    | $PropertyType<WebGL2RenderingContext, 'NEVER'>
    | $PropertyType<WebGL2RenderingContext, 'LESS'>
    | $PropertyType<WebGL2RenderingContext, 'EQUAL'>
    | $PropertyType<WebGL2RenderingContext, 'LEQUAL'>
    | $PropertyType<WebGL2RenderingContext, 'GREATER'>
    | $PropertyType<WebGL2RenderingContext, 'NOTEQUAL'>
    | $PropertyType<WebGL2RenderingContext, 'GEQUAL'>
    | $PropertyType<WebGL2RenderingContext, 'ALWAYS'>;

export type DepthMaskType = boolean;

export type DepthRangeType = [number, number];

export type DepthFuncType = CompareFuncType;

export type StencilFuncType = {
    func: CompareFuncType,
    ref: number,
    mask: number
};

export type StencilOpConstant =
    | $PropertyType<WebGL2RenderingContext, 'KEEP'>
    | $PropertyType<WebGL2RenderingContext, 'ZERO'>
    | $PropertyType<WebGL2RenderingContext, 'REPLACE'>
    | $PropertyType<WebGL2RenderingContext, 'INCR'>
    | $PropertyType<WebGL2RenderingContext, 'INCR_WRAP'>
    | $PropertyType<WebGL2RenderingContext, 'DECR'>
    | $PropertyType<WebGL2RenderingContext, 'DECR_WRAP'>
    | $PropertyType<WebGL2RenderingContext, 'INVERT'>;

export type StencilOpType = [StencilOpConstant, StencilOpConstant, StencilOpConstant];

export type TextureUnitType = number;

export type ViewportType = [number, number, number, number];

export type StencilTest =
    | { func: $PropertyType<WebGL2RenderingContext, 'NEVER'>, mask: 0 }
    | { func: $PropertyType<WebGL2RenderingContext, 'LESS'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'EQUAL'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'LEQUAL'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'GREATER'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'NOTEQUAL'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'GEQUAL'>, mask: number }
    | { func: $PropertyType<WebGL2RenderingContext, 'ALWAYS'>, mask: 0 };

export type CullFaceModeType =
    | $PropertyType<WebGL2RenderingContext, 'FRONT'>
    | $PropertyType<WebGL2RenderingContext, 'BACK'>
    | $PropertyType<WebGL2RenderingContext, 'FRONT_AND_BACK'>

export type FrontFaceType =
    | $PropertyType<WebGL2RenderingContext, 'CW'>
    | $PropertyType<WebGL2RenderingContext, 'CCW'>

export type DepthBufferType = 'renderbuffer' | 'texture';
