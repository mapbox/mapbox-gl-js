import {fillExtrusionDepthUniforms, fillExtrusionUniforms, fillExtrusionPatternUniforms, fillExtrusionGroundEffectUniforms} from './fill_extrusion_program';
import {fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms} from './fill_program';
import {circleUniforms} from './circle_program';
import {collisionUniforms, collisionCircleUniforms} from './collision_program';
import {debugUniforms} from './debug_program';
import {clippingMaskUniforms} from './clipping_mask_program';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program';
import {lineUniforms, linePatternUniforms} from './line_program';
import {rasterUniforms} from './raster_program';
import {rasterParticleUniforms, rasterParticleTextureUniforms, rasterParticleDrawUniforms, rasterParticleUpdateUniforms} from './raster_particle_program';
import {symbolUniforms} from './symbol_program';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program';
import {terrainRasterUniforms} from '../../terrain/terrain_raster_program';
import {skyboxUniforms, skyboxGradientUniforms} from './skybox_program';
import {skyboxCaptureUniforms} from './skybox_capture_program';
import {globeRasterUniforms, atmosphereUniforms} from '../../terrain/globe_raster_program';
import {modelUniforms, modelDepthUniforms} from '../../../3d-style/render/program/model_program';
import {groundShadowUniforms} from '../../../3d-style/render/program/ground_shadow_program';
import {starsUniforms} from '../../terrain/stars_program';
import {occlusionUniforms} from './occlusion_program';
import {snowUniforms} from '../../precipitation/snow_program';
import {rainUniforms} from "../../precipitation/rain_program";
import {vignetteUniforms} from "../../precipitation/vignette_program";

import type {GlobeDefinesType} from '../../terrain/globe_raster_program';
import type {HeatmapDefinesType} from './heatmap_program';
import type {HillshadeDefinesType} from './hillshade_program';
import type {LineDefinesType} from './line_program';
import type {SymbolDefinesType} from './symbol_program';
import type {RasterParticleDefinesType} from './raster_particle_program';
import type {RasterDefinesType} from './raster_program';
import type {CircleDefinesType} from './circle_program';
import type {ModelDefinesType} from '../../../3d-style/render/program/model_program';

export type FogDefinesType = ['FOG', 'FOG_DITHERING'];
export type TerrainDepthAccessDefinesType = 'DEPTH_D24' | 'DEPTH_OCCLUSION';

type GlobalDefinesType =
    | 'DEBUG_WIREFRAME'
    | 'DEPTH_TEXTURE'
    | 'FOG_DITHERING'
    | 'FOG'
    | 'GLOBE'
    | 'LIGHTING_3D_ALPHA_EMISSIVENESS'
    | 'LIGHTING_3D_MODE'
    | 'NORMAL_OFFSET'
    | 'OVERDRAW_INSPECTOR'
    | 'RENDER_CUTOFF'
    | 'RENDER_SHADOWS'
    | 'RENDER_TO_TEXTURE'
    | 'TERRAIN_DEM_FLOAT_FORMAT'
    | 'TERRAIN';

export type DynamicDefinesType =
    | GlobalDefinesType
    | CircleDefinesType
    | SymbolDefinesType
    | LineDefinesType
    | HeatmapDefinesType
    | GlobeDefinesType
    | RasterDefinesType
    | RasterParticleDefinesType
    | FogDefinesType
    | HillshadeDefinesType
    | TerrainDepthAccessDefinesType
    | ModelDefinesType;

export const programUniforms = {
    fillExtrusion: fillExtrusionUniforms,
    fillExtrusionDepth: fillExtrusionDepthUniforms,
    fillExtrusionPattern: fillExtrusionPatternUniforms,
    fillExtrusionGroundEffect: fillExtrusionGroundEffectUniforms,
    fill: fillUniforms,
    fillPattern: fillPatternUniforms,
    fillOutline: fillOutlineUniforms,
    fillOutlinePattern: fillOutlinePatternUniforms,
    circle: circleUniforms,
    collisionBox: collisionUniforms,
    collisionCircle: collisionCircleUniforms,
    debug: debugUniforms,
    clippingMask: clippingMaskUniforms,
    heatmap: heatmapUniforms,
    heatmapTexture: heatmapTextureUniforms,
    hillshade: hillshadeUniforms,
    hillshadePrepare: hillshadePrepareUniforms,
    line: lineUniforms,
    linePattern: linePatternUniforms,
    raster: rasterUniforms,
    rasterParticle: rasterParticleUniforms,
    rasterParticleTexture: rasterParticleTextureUniforms,
    rasterParticleDraw: rasterParticleDrawUniforms,
    rasterParticleUpdate: rasterParticleUpdateUniforms,
    symbol: symbolUniforms,
    background: backgroundUniforms,
    backgroundPattern: backgroundPatternUniforms,
    terrainRaster: terrainRasterUniforms,
    skybox: skyboxUniforms,
    skyboxGradient: skyboxGradientUniforms,
    skyboxCapture: skyboxCaptureUniforms,
    globeRaster: globeRasterUniforms,
    globeAtmosphere: atmosphereUniforms,
    model: modelUniforms,
    modelDepth: modelDepthUniforms,
    groundShadow: groundShadowUniforms,
    stars: starsUniforms,
    snowParticle: snowUniforms,
    rainParticle: rainUniforms,
    vignette: vignetteUniforms,
    occlusion: occlusionUniforms
} as const;
