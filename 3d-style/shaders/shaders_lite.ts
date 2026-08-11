import {compile} from '../../src/shaders/shaders';
import terrainRasterFrag from '../../src/shaders/terrain_raster.fragment.glsl';
import terrainRasterVert from '../../src/shaders/terrain_raster.vertex.glsl';
import terrainDepthFrag from '../../src/shaders/terrain_depth.fragment.glsl';
import terrainDepthVert from '../../src/shaders/terrain_depth.vertex.glsl';
import globeRasterFrag from '../../src/shaders/globe_raster.fragment.glsl';
import globeRasterVert from '../../src/shaders/globe_raster.vertex.glsl';

export default {
    terrainRaster: compile(terrainRasterFrag, terrainRasterVert),
    terrainDepth: compile(terrainDepthFrag, terrainDepthVert),
    globeRaster: compile(globeRasterFrag, globeRasterVert),
} as const;
