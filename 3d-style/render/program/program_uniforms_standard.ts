import {modelUniforms, modelDepthUniforms} from './model_program';

export const programUniforms = {
    model: modelUniforms,
    modelDepth: modelDepthUniforms,
} as const;

export type ProgramUniformsStandardType = {
    [K in keyof typeof programUniforms]: ReturnType<typeof programUniforms[K]>;
};
