import {compile} from '../../src/shaders/shaders';
import modelVert from './model.vertex.glsl';
import modelFrag from './model.fragment.glsl';
import modelDepthVert from './model_depth.vertex.glsl';
import modelDepthFrag from './model_depth.fragment.glsl';

export default {
    model: compile(modelFrag, modelVert),
    modelDepth: compile(modelDepthFrag, modelDepthVert),
} as const;
