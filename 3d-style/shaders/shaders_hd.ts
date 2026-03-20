// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../src/types/glsl.d.ts" />

import buildingFrag from './building.fragment.glsl';
import buildingVert from './building.vertex.glsl';
import buildingBloomFrag from './building_bloom.fragment.glsl';
import buildingBloomVert from './building_bloom.vertex.glsl';
import buildingDepthFrag from './building_depth.fragment.glsl';
import buildingDepthVert from './building_depth.vertex.glsl';
import rasterParticleFrag from '../../src/shaders/raster_particle.fragment.glsl';
import rasterParticleVert from '../../src/shaders/raster_particle.vertex.glsl';
import rasterParticleDrawFrag from '../../src/shaders/raster_particle_draw.fragment.glsl';
import rasterParticleDrawVert from '../../src/shaders/raster_particle_draw.vertex.glsl';
import rasterParticleTextureFrag from '../../src/shaders/raster_particle_texture.fragment.glsl';
import rasterParticleTextureVert from '../../src/shaders/raster_particle_texture.vertex.glsl';
import rasterParticleUpdateFrag from '../../src/shaders/raster_particle_update.fragment.glsl';
import rasterParticleUpdateVert from '../../src/shaders/raster_particle_update.vertex.glsl';
import preludeRasterParticleFrag from '../../src/shaders/_prelude_raster_particle.glsl';
import {compile, includeMap} from '../../src/shaders/shaders';

// Register raster particle prelude in includeMap when HD module loads
if (!includeMap['_prelude_raster_particle.glsl']) {
    includeMap['_prelude_raster_particle.glsl'] = preludeRasterParticleFrag;
}

export default {
    building: compile(buildingFrag, buildingVert),
    buildingBloom: compile(buildingBloomFrag, buildingBloomVert),
    buildingDepth: compile(buildingDepthFrag, buildingDepthVert),
    rasterParticle: compile(rasterParticleFrag, rasterParticleVert),
    rasterParticleDraw: compile(rasterParticleDrawFrag, rasterParticleDrawVert),
    rasterParticleTexture: compile(rasterParticleTextureFrag, rasterParticleTextureVert),
    rasterParticleUpdate: compile(rasterParticleUpdateFrag, rasterParticleUpdateVert),
};

export const preludeShaders = {
    preludeRasterParticle: compile(preludeRasterParticleFrag, ''),
} as const;
