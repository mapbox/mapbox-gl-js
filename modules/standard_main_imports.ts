import drawModels, {prepare} from '../3d-style/render/draw_model';
import shaders from '../3d-style/shaders/shaders_standard';
import {programUniforms} from '../3d-style/render/program/program_uniforms_standard';
import {ShadowRenderer} from '../3d-style/render/shadow_renderer';
import {drawGroundEffect} from '../3d-style/render/draw_ground_effect';
// Side-effect imports: register() calls ensure main-thread deserialization works
// when tiles carrying ModelBucket or Tiled3dModelBucket arrive from the worker.
import '../3d-style/data/bucket/model_bucket';
import '../3d-style/data/bucket/tiled_3d_model_bucket';

export const Standard = {
    loaded: true,
    drawModels,
    prepare,
    shaders,
    programUniforms,
    ShadowRenderer,
    drawGroundEffect,
};
