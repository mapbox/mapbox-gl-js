import {
    Uniform1i,
    Uniform1f,
    type UniformValues
} from '../uniform_binding';

import type Context from '../../gl/context';

// Blend mode integer values passed to u_blend_mode
export const LINE_BLEND_MODE_MULTIPLY = 0;
export const LINE_BLEND_MODE_ADDITIVE = 1;

export type LineBlendCompositeUniformsType = {
    ['u_image']: Uniform1i;
    ['u_opacity']: Uniform1f;
    ['u_blend_mode']: Uniform1i;
};

export const lineBlendCompositeUniforms = (context: Context): LineBlendCompositeUniformsType => ({
    'u_image': new Uniform1i(context),
    'u_opacity': new Uniform1f(context),
    'u_blend_mode': new Uniform1i(context),
});

export const lineBlendCompositeUniformValues = (
    textureUnit: number,
    opacity: number,
    blendMode: number,
): UniformValues<LineBlendCompositeUniformsType> => ({
    'u_image': textureUnit,
    'u_opacity': opacity,
    'u_blend_mode': blendMode,
});
