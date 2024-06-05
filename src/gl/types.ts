type BlendFuncConstant = WebGL2RenderingContext['ZERO'] | WebGL2RenderingContext['ONE'] | WebGL2RenderingContext['SRC_COLOR'] | WebGL2RenderingContext['ONE_MINUS_SRC_COLOR'] | WebGL2RenderingContext['DST_COLOR'] | WebGL2RenderingContext['ONE_MINUS_DST_COLOR'] | WebGL2RenderingContext['SRC_ALPHA'] | WebGL2RenderingContext['ONE_MINUS_SRC_ALPHA'] | WebGL2RenderingContext['DST_ALPHA'] | WebGL2RenderingContext['ONE_MINUS_DST_ALPHA'] | WebGL2RenderingContext['CONSTANT_COLOR'] | WebGL2RenderingContext['ONE_MINUS_CONSTANT_COLOR'] | WebGL2RenderingContext['CONSTANT_ALPHA'] | WebGL2RenderingContext['ONE_MINUS_CONSTANT_ALPHA'] | WebGL2RenderingContext['BLEND_COLOR'];

export type BlendFuncType = [BlendFuncConstant, BlendFuncConstant, BlendFuncConstant, BlendFuncConstant];

export type BlendEquationType = WebGL2RenderingContext['FUNC_ADD'] | WebGL2RenderingContext['FUNC_SUBTRACT'] | WebGL2RenderingContext['FUNC_REVERSE_SUBTRACT'] | WebGL2RenderingContext['MIN'] | WebGL2RenderingContext['MAX'];

export type ColorMaskType = [boolean, boolean, boolean, boolean];

export type CompareFuncType = WebGL2RenderingContext['NEVER'] | WebGL2RenderingContext['LESS'] | WebGL2RenderingContext['EQUAL'] | WebGL2RenderingContext['LEQUAL'] | WebGL2RenderingContext['GREATER'] | WebGL2RenderingContext['NOTEQUAL'] | WebGL2RenderingContext['GEQUAL'] | WebGL2RenderingContext['ALWAYS'];

export type DepthMaskType = boolean;

export type DepthRangeType = [number, number];

export type DepthFuncType = CompareFuncType;

export type StencilFuncType = {
    func: CompareFuncType;
    ref: number;
    mask: number;
};

export type StencilOpConstant = WebGL2RenderingContext['KEEP'] | WebGL2RenderingContext['ZERO'] | WebGL2RenderingContext['REPLACE'] | WebGL2RenderingContext['INCR'] | WebGL2RenderingContext['INCR_WRAP'] | WebGL2RenderingContext['DECR'] | WebGL2RenderingContext['DECR_WRAP'] | WebGL2RenderingContext['INVERT'];

export type StencilOpType = [StencilOpConstant, StencilOpConstant, StencilOpConstant];

export type TextureUnitType = number;

export type ViewportType = [number, number, number, number];

export type StencilTest = {
    func: WebGL2RenderingContext['NEVER'];
    mask: 0;
} | {
    func: WebGL2RenderingContext['LESS'];
    mask: number;
} | {
    func: WebGL2RenderingContext['EQUAL'];
    mask: number;
} | {
    func: WebGL2RenderingContext['LEQUAL'];
    mask: number;
} | {
    func: WebGL2RenderingContext['GREATER'];
    mask: number;
} | {
    func: WebGL2RenderingContext['NOTEQUAL'];
    mask: number;
} | {
    func: WebGL2RenderingContext['GEQUAL'];
    mask: number;
} | {
    func: WebGL2RenderingContext['ALWAYS'];
    mask: 0;
};

export type CullFaceModeType = WebGL2RenderingContext['FRONT'] | WebGL2RenderingContext['BACK'] | WebGL2RenderingContext['FRONT_AND_BACK'];

export type FrontFaceType = WebGL2RenderingContext['CW'] | WebGL2RenderingContext['CCW'];

export type DepthBufferType = 'renderbuffer' | 'texture';
