// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/glsl.d.ts" />

import snowFrag from './snow_particle.fragment.glsl';
import snowVert from './snow_particle.vertex.glsl';
import rainFrag from './rain_particle.fragment.glsl';
import rainVert from './rain_particle.vertex.glsl';
import vignetteFrag from './vignette.fragment.glsl';
import vignetteVert from './vignette.vertex.glsl';
import {compile} from './shaders';

export default {
    snowParticle: compile(snowFrag, snowVert),
    rainParticle: compile(rainFrag, rainVert),
    vignette: compile(vignetteFrag, vignetteVert)
};
