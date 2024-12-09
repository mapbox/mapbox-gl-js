import {
    Uniform4f,
    Uniform3f,
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues} from '../render/uniform_binding.js';

export type VignetteUniformsType = {
    'u_vignetteShape': Uniform3f,
    'u_vignetteColor': Uniform4f,
};

const vignetteUniforms = (context: Context): VignetteUniformsType => ({
    'u_vignetteShape': new Uniform3f(context),
    'u_vignetteColor': new Uniform4f(context),
});

const vignetteUniformValues = (values: {
    vignetteShape: [number, number, number],
    vignetteColor: [number, number, number, number],
}
): UniformValues<VignetteUniformsType> => ({
    'u_vignetteShape': values.vignetteShape,
    'u_vignetteColor': values.vignetteColor,
});

export {vignetteUniforms, vignetteUniformValues};
