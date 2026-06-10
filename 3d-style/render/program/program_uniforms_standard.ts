import {modelUniforms, modelDepthUniforms} from './model_program';
import {groundShadowUniforms} from './ground_shadow_program';
import {fillExtrusionDepthUniforms} from '../../../src/render/program/fill_extrusion_program';
import {fillExtrusionGroundEffectUniforms} from '../draw_ground_effect';

export const programUniforms = {
    model: modelUniforms,
    modelDepth: modelDepthUniforms,
    groundShadow: groundShadowUniforms,
    fillExtrusionDepth: fillExtrusionDepthUniforms,
    fillExtrusionGroundEffect: fillExtrusionGroundEffectUniforms,
} as const;

export type ProgramUniformsStandardType = {
    [K in keyof typeof programUniforms]: ReturnType<typeof programUniforms[K]>;
};
