import {Terrain} from '../src/terrain/terrain';
import {registerTerrainRenderer} from '../src/render/terrain_plugin';
import {programUniforms as coreProgramUniforms} from '../src/render/program/program_uniforms';
import {terrainRasterUniforms} from '../src/terrain/terrain_raster_program';
import {globeRasterUniforms} from '../src/terrain/globe_raster_program';
import shaders from '../3d-style/shaders/shaders_lite';

// Register the terrain renderer factory so painter.updateTerrain() can create instances.
registerTerrainRenderer({
    create: (painter, style) => new Terrain(painter, style),
});

// Register terrain and globe-surface shader programs into the core programUniforms store
// so that painter.getOrCreateProgram() can find them.
Object.assign(coreProgramUniforms, {
    terrainRaster: terrainRasterUniforms,
    globeRaster: globeRasterUniforms,
});

export const Lite = {
    loaded: true,
    shaders,
};
