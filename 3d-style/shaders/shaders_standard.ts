import {compile} from '../../src/shaders/shaders';
import modelVert from './model.vertex.glsl';
import modelFrag from './model.fragment.glsl';
import modelDepthVert from './model_depth.vertex.glsl';
import modelDepthFrag from './model_depth.fragment.glsl';
import fillExtrusionDepthFrag from './fill_extrusion_depth.fragment.glsl';
import fillExtrusionDepthVert from './fill_extrusion_depth.vertex.glsl';
import fillExtrusionGroundEffectFrag from './fill_extrusion_ground_effect.fragment.glsl';
import fillExtrusionGroundEffectVert from './fill_extrusion_ground_effect.vertex.glsl';
import groundShadowFrag from './ground_shadow.fragment.glsl';
import groundShadowVert from './ground_shadow.vertex.glsl';

export default {
    model: compile(modelFrag, modelVert),
    modelDepth: compile(modelDepthFrag, modelDepthVert),
    fillExtrusionDepth: compile(fillExtrusionDepthFrag, fillExtrusionDepthVert),
    fillExtrusionGroundEffect: compile(fillExtrusionGroundEffectFrag, fillExtrusionGroundEffectVert),
    groundShadow: compile(groundShadowFrag, groundShadowVert),
} as const;
