import {buildingUniforms, buildingBloomUniforms, buildingDepthUniforms} from './building_program';
import {rasterParticleUniforms, rasterParticleTextureUniforms, rasterParticleDrawUniforms, rasterParticleUpdateUniforms} from '../../../src/render/program/raster_particle_program';
import {snowUniforms} from '../../../src/precipitation/snow_program';
import {rainUniforms} from "../../../src/precipitation/rain_program";
import {vignetteUniforms} from "../../../src/precipitation/vignette_program";

export const programUniforms = {
    building: buildingUniforms,
    buildingBloom: buildingBloomUniforms,
    buildingDepth: buildingDepthUniforms,
    rasterParticle: rasterParticleUniforms,
    rasterParticleTexture: rasterParticleTextureUniforms,
    rasterParticleDraw: rasterParticleDrawUniforms,
    rasterParticleUpdate: rasterParticleUpdateUniforms,
    snowParticle: snowUniforms,
    rainParticle: rainUniforms,
    vignette: vignetteUniforms
} as const;

export type ProgramUniformsHDType = {
    [K in keyof typeof programUniforms]: ReturnType<typeof programUniforms[K]>;
};

