// @flow

import type {CircleDefinesType} from './circle_program.js';
import type {RasterDefinesType} from './raster_program.js';
import type {RasterParticleDefinesType} from './raster_particle_program.js';
import type {SymbolDefinesType} from './symbol_program.js';
import type {LineDefinesType} from './line_program.js';
import type {HillshadeDefinesType} from "./hillshade_program.js";
import {fillExtrusionDepthUniforms, fillExtrusionUniforms, fillExtrusionPatternUniforms, fillExtrusionGroundEffectUniforms} from './fill_extrusion_program.js';
import {fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms} from './fill_program.js';
import {circleUniforms} from './circle_program.js';
import {collisionUniforms, collisionCircleUniforms} from './collision_program.js';
import {debugUniforms} from './debug_program.js';
import {clippingMaskUniforms} from './clipping_mask_program.js';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program.js';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program.js';
import {lineUniforms, linePatternUniforms} from './line_program.js';
import {rasterUniforms} from './raster_program.js';
import {rasterParticleUniforms, rasterParticleTextureUniforms, rasterParticleDrawUniforms, rasterParticleUpdateUniforms} from './raster_particle_program.js';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program.js';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program.js';
import {terrainRasterUniforms} from '../../terrain/terrain_raster_program.js';
import {skyboxUniforms, skyboxGradientUniforms} from './skybox_program.js';
import {skyboxCaptureUniforms} from './skybox_capture_program.js';
import {globeRasterUniforms, atmosphereUniforms} from '../../terrain/globe_raster_program.js';
import type {HeatmapDefinesType} from './heatmap_program.js';
import type {DebugDefinesType} from './debug_program.js';
import type {GlobeDefinesType} from '../../terrain/globe_raster_program.js';

import {modelUniforms, modelDepthUniforms} from '../../../3d-style/render/program/model_program.js';
import {groundShadowUniforms} from '../../../3d-style/render/program/ground_shadow_program.js';
import {starsUniforms} from '../../terrain/stars_program.js';

export type FogDefinesType = ['FOG', 'FOG_DITHERING'];
export type DynamicDefinesType = CircleDefinesType | SymbolDefinesType | LineDefinesType | HeatmapDefinesType | DebugDefinesType | GlobeDefinesType | RasterDefinesType | RasterParticleDefinesType | FogDefinesType | HillshadeDefinesType;

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
    symbolIcon: symbolIconUniforms,
    symbolSDF: symbolSDFUniforms,
    symbolTextAndIcon: symbolTextAndIconUniforms,
    background: backgroundUniforms,
    backgroundPattern: backgroundPatternUniforms,
    terrainRaster: terrainRasterUniforms,
    terrainDepth: terrainRasterUniforms,
    skybox: skyboxUniforms,
    skyboxGradient: skyboxGradientUniforms,
    skyboxCapture: skyboxCaptureUniforms,
    globeRaster: globeRasterUniforms,
    globeAtmosphere: atmosphereUniforms,
    model: modelUniforms,
    modelDepth: modelDepthUniforms,
    groundShadow: groundShadowUniforms,
    stars: starsUniforms,
};
