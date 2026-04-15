// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../src/types/glsl.d.ts" />

import buildingFrag from './building.fragment.glsl';
import buildingVert from './building.vertex.glsl';
import buildingBloomFrag from './building_bloom.fragment.glsl';
import buildingBloomVert from './building_bloom.vertex.glsl';
import buildingDepthFrag from './building_depth.fragment.glsl';
import buildingDepthVert from './building_depth.vertex.glsl';
import {compile} from '../../src/shaders/shaders';

export default {
    building: compile(buildingFrag, buildingVert),
    buildingBloom: compile(buildingBloomFrag, buildingBloomVert),
    buildingDepth: compile(buildingDepthFrag, buildingDepthVert),
};
