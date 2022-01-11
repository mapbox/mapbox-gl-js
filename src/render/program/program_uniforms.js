// @flow

import type {CircleDefinesType} from './circle_program.js';
import type {SymbolDefinesType} from './symbol_program.js';
import type {LineDefinesType} from './line_program.js';
import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from './fill_extrusion_program.js';
import {fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms} from './fill_program.js';
import {circleUniforms} from './circle_program.js';
import {collisionUniforms, collisionCircleUniforms} from './collision_program.js';
import {debugUniforms} from './debug_program.js';
import {clippingMaskUniforms} from './clipping_mask_program.js';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program.js';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program.js';
import {lineUniforms, linePatternUniforms} from './line_program.js';
import {rasterUniforms} from './raster_program.js';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program.js';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program.js';
import {terrainRasterUniforms} from '../../terrain/terrain_raster_program.js';
import {skyboxUniforms, skyboxGradientUniforms} from './skybox_program.js';
import {skyboxCaptureUniforms} from './skybox_capture_program.js';
import {globeRasterUniforms, atmosphereUniforms} from '../../terrain/globe_raster_program.js';

export type DynamicDefinesType = CircleDefinesType | SymbolDefinesType | LineDefinesType;

export const programUniforms = {
    fillExtrusion: fillExtrusionUniforms,
    fillExtrusionPattern: fillExtrusionPatternUniforms,
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
};
