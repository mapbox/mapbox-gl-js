// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/glsl.d.ts" />

import assert from 'assert';
import preludeCommon from './_prelude.glsl';
import preludeFrag from './_prelude.fragment.glsl';
import preludeVert from './_prelude.vertex.glsl';
import backgroundFrag from './background.fragment.glsl';
import backgroundVert from './background.vertex.glsl';
import backgroundPatternFrag from './background_pattern.fragment.glsl';
import backgroundPatternVert from './background_pattern.vertex.glsl';
import buildingFrag from '../../3d-style/shaders/building.fragment.glsl';
import buildingVert from '../../3d-style/shaders/building.vertex.glsl';
import buildingBloomFrag from '../../3d-style/shaders/building_bloom.fragment.glsl';
import buildingBloomVert from '../../3d-style/shaders/building_bloom.vertex.glsl';
import buildingDepthFrag from '../../3d-style/shaders/building_depth.fragment.glsl';
import buildingDepthVert from '../../3d-style/shaders/building_depth.vertex.glsl';
import circleFrag from './circle.fragment.glsl';
import circleVert from './circle.vertex.glsl';
import clippingMaskFrag from './clipping_mask.fragment.glsl';
import clippingMaskVert from './clipping_mask.vertex.glsl';
import heatmapFrag from './heatmap.fragment.glsl';
import heatmapVert from './heatmap.vertex.glsl';
import heatmapTextureFrag from './heatmap_texture.fragment.glsl';
import heatmapTextureVert from './heatmap_texture.vertex.glsl';
import collisionBoxFrag from './collision_box.fragment.glsl';
import collisionBoxVert from './collision_box.vertex.glsl';
import collisionCircleFrag from './collision_circle.fragment.glsl';
import collisionCircleVert from './collision_circle.vertex.glsl';
import debugFrag from './debug.fragment.glsl';
import debugVert from './debug.vertex.glsl';
import fillFrag from './fill.fragment.glsl';
import fillVert from './fill.vertex.glsl';
import fillOutlineFrag from './fill_outline.fragment.glsl';
import fillOutlineVert from './fill_outline.vertex.glsl';
import fillOutlinePatternFrag from './fill_outline_pattern.fragment.glsl';
import fillOutlinePatternVert from './fill_outline_pattern.vertex.glsl';
import fillPatternFrag from './fill_pattern.fragment.glsl';
import fillPatternVert from './fill_pattern.vertex.glsl';
import fillExtrusionFrag from './fill_extrusion.fragment.glsl';
import fillExtrusionVert from './fill_extrusion.vertex.glsl';
import fillExtrusionPatternFrag from './fill_extrusion_pattern.fragment.glsl';
import fillExtrusionPatternVert from './fill_extrusion_pattern.vertex.glsl';
import hillshadePrepareFrag from './hillshade_prepare.fragment.glsl';
import fillExtrusionGroundEffectFrag from './fill_extrusion_ground_effect.fragment.glsl';
import fillExtrusionGroundEffectVert from './fill_extrusion_ground_effect.vertex.glsl';
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl';
import hillshadeFrag from './hillshade.fragment.glsl';
import hillshadeVert from './hillshade.vertex.glsl';
import lineFrag from './line.fragment.glsl';
import lineVert from './line.vertex.glsl';
import linePatternFrag from './line_pattern.fragment.glsl';
import linePatternVert from './line_pattern.vertex.glsl';
import rasterFrag from './raster.fragment.glsl';
import rasterVert from './raster.vertex.glsl';
import rasterParticleFrag from './raster_particle.fragment.glsl';
import rasterParticleVert from './raster_particle.vertex.glsl';
import rasterParticleDrawFrag from './raster_particle_draw.fragment.glsl';
import rasterParticleDrawVert from './raster_particle_draw.vertex.glsl';
import rasterParticleTextureFrag from './raster_particle_texture.fragment.glsl';
import rasterParticleTextureVert from './raster_particle_texture.vertex.glsl';
import rasterParticleUpdateFrag from './raster_particle_update.fragment.glsl';
import rasterParticleUpdateVert from './raster_particle_update.vertex.glsl';
import symbolFrag from './symbol.fragment.glsl';
import symbolVert from './symbol.vertex.glsl';
import skyboxFrag from './skybox.fragment.glsl';
import skyboxGradientFrag from './skybox_gradient.fragment.glsl';
import skyboxVert from './skybox.vertex.glsl';
import terrainRasterFrag from './terrain_raster.fragment.glsl';
import terrainRasterVert from './terrain_raster.vertex.glsl';
import terrainDepthFrag from './terrain_depth.fragment.glsl';
import terrainDepthVert from './terrain_depth.vertex.glsl';
import preludeTerrainVert from './_prelude_terrain.vertex.glsl';
import preludeFogVert from './_prelude_fog.vertex.glsl';
import preludeFogFrag from './_prelude_fog.fragment.glsl';
import preludeLighting from './_prelude_lighting.glsl';
import preludeRasterArrayFrag from './_prelude_raster_array.glsl';
import preludeRasterParticleFrag from './_prelude_raster_particle.glsl';
import skyboxCaptureFrag from './skybox_capture.fragment.glsl';
import skyboxCaptureVert from './skybox_capture.vertex.glsl';
import globeFrag from './globe_raster.fragment.glsl';
import globeVert from './globe_raster.vertex.glsl';
import atmosphereFrag from './atmosphere.fragment.glsl';
import atmosphereVert from './atmosphere.vertex.glsl';
import starsFrag from './stars.fragment.glsl';
import starsVert from './stars.vertex.glsl';
import snowFrag from './snow_particle.fragment.glsl';
import snowVert from './snow_particle.vertex.glsl';
import rainFrag from './rain_particle.fragment.glsl';
import rainVert from './rain_particle.vertex.glsl';
import vignetteFrag from './vignette.fragment.glsl';
import vignetteVert from './vignette.vertex.glsl';
import occlusionFrag from './occlusion.fragment.glsl';
import occlusionVert from './occlusion.vertex.glsl';
import elevatedStructuresDepthReconstructFrag from '../../3d-style/shaders/elevated_structures_depth_reconstruct.fragment.glsl';
import elevatedStructuresDepthReconstructVert from '../../3d-style/shaders/elevated_structures_depth_reconstruct.vertex.glsl';
import elevatedStructuresDepthFrag from '../../3d-style/shaders/elevated_structures_depth.fragment.glsl';
import elevatedStructuresDepthVert from '../../3d-style/shaders/elevated_structures_depth.vertex.glsl';
import elevatedStructuresModelFrag from '../../3d-style/shaders/elevated_structures_model.fragment.glsl';
import elevatedStructuresModelVert from '../../3d-style/shaders/elevated_structures_model.vertex.glsl';
// 3d-style related shaders
import fillExtrusionDepthFrag from '../../3d-style/shaders/fill_extrusion_depth.fragment.glsl';
import fillExtrusionDepthVert from '../../3d-style/shaders/fill_extrusion_depth.vertex.glsl';
import groundShadowFrag from '../../3d-style/shaders/ground_shadow.fragment.glsl';
import groundShadowVert from '../../3d-style/shaders/ground_shadow.vertex.glsl';
import modelVert from '../../3d-style/shaders/model.vertex.glsl';
import modelFrag from '../../3d-style/shaders/model.fragment.glsl';
import modelDepthVert from '../../3d-style/shaders/model_depth.vertex.glsl';
import modelDepthFrag from '../../3d-style/shaders/model_depth.fragment.glsl';
import preludeShadowVert from '../../3d-style/shaders/_prelude_shadow.vertex.glsl';
import preludeShadowFrag from '../../3d-style/shaders/_prelude_shadow.fragment.glsl';
import preludeMaterialTableVert from './_prelude_material_table.vertex.glsl';

import type {ShaderSource} from '../render/program';
import type {DynamicDefinesType} from '../render/program/program_uniforms';

const INCLUDE_REGEX = /#include\s+"([^"]+)"/g;
const PRAGMA_REGEX = /#pragma mapbox: ([\w\-]+) ([\w]+) ([\w]+) ([\w]+)/g;

const IDENTIFIER_REGEX = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
const PREPROCESSOR_KEYWORDS = new Set(['ifdef', 'ifndef', 'elif', 'if', 'defined']);

const commonDefines: Set<DynamicDefinesType> = new Set();
parseUsedPreprocessorDefines(preludeCommon, commonDefines);
parseUsedPreprocessorDefines(preludeVert, commonDefines);
parseUsedPreprocessorDefines(preludeFrag, commonDefines);

export const includeMap: Record<string, string> = {
    '_prelude_fog.vertex.glsl': preludeFogVert,
    '_prelude_terrain.vertex.glsl': preludeTerrainVert,
    '_prelude_shadow.vertex.glsl': preludeShadowVert,
    '_prelude_material_table.vertex.glsl': preludeMaterialTableVert,
    '_prelude_fog.fragment.glsl': preludeFogFrag,
    '_prelude_shadow.fragment.glsl': preludeShadowFrag,
    '_prelude_lighting.glsl': preludeLighting,
    '_prelude_raster_array.glsl': preludeRasterArrayFrag,
    '_prelude_raster_particle.glsl': preludeRasterParticleFrag
};

// Populated during precompilation
const defineMap: Record<string, Set<DynamicDefinesType>> = {};
export const preludeTerrain = compile('', preludeTerrainVert);
export const preludeFog = compile(preludeFogFrag, preludeFogVert);
export const preludeShadow = compile(preludeShadowFrag, preludeShadowVert);
export const preludeRasterArray = compile(preludeRasterArrayFrag, '');
export const preludeRasterParticle = compile(preludeRasterParticleFrag, '');
export const prelude = compile(preludeFrag, preludeVert);
export const preludeCommonSource = preludeCommon;
export const preludeLightingSource = preludeLighting;

export const preludeVertPrecisionQualifiers = `precision highp float;`;
export const preludeFragPrecisionQualifiers = `precision mediump float;`;

export const preludeFragExtensions = `
#if defined(GL_EXT_blend_func_extended) && defined(DUAL_SOURCE_BLENDING)
#extension GL_EXT_blend_func_extended : require
#endif`;

export const FRAGMENT_PRELUDE_BLOCK = [
    preludeFragExtensions,
    preludeFragPrecisionQualifiers,
    preludeCommonSource,
    prelude.fragmentSource
].join('\n');

export const VERTEX_PRELUDE_BLOCK = [
    preludeVertPrecisionQualifiers,
    preludeCommonSource,
    prelude.vertexSource
].join('\n');

export default {
    background: compile(backgroundFrag, backgroundVert),
    backgroundPattern: compile(backgroundPatternFrag, backgroundPatternVert),
    building: compile(buildingFrag, buildingVert),
    buildingBloom: compile(buildingBloomFrag, buildingBloomVert),
    buildingDepth: compile(buildingDepthFrag, buildingDepthVert),
    circle: compile(circleFrag, circleVert),
    clippingMask: compile(clippingMaskFrag, clippingMaskVert),
    heatmap: compile(heatmapFrag, heatmapVert),
    heatmapTexture: compile(heatmapTextureFrag, heatmapTextureVert),
    collisionBox: compile(collisionBoxFrag, collisionBoxVert),
    collisionCircle: compile(collisionCircleFrag, collisionCircleVert),
    debug: compile(debugFrag, debugVert),
    elevatedStructuresDepth: compile(elevatedStructuresDepthFrag, elevatedStructuresDepthVert),
    elevatedStructuresDepthReconstruct: compile(elevatedStructuresDepthReconstructFrag, elevatedStructuresDepthReconstructVert),
    elevatedStructures: compile(elevatedStructuresModelFrag, elevatedStructuresModelVert),
    fill: compile(fillFrag, fillVert),
    fillOutline: compile(fillOutlineFrag, fillOutlineVert),
    fillOutlinePattern: compile(fillOutlinePatternFrag, fillOutlinePatternVert),
    fillPattern: compile(fillPatternFrag, fillPatternVert),
    fillExtrusion: compile(fillExtrusionFrag, fillExtrusionVert),
    fillExtrusionDepth: compile(fillExtrusionDepthFrag, fillExtrusionDepthVert),
    fillExtrusionPattern: compile(fillExtrusionPatternFrag, fillExtrusionPatternVert),
    groundShadow: compile(groundShadowFrag, groundShadowVert),
    fillExtrusionGroundEffect: compile(fillExtrusionGroundEffectFrag, fillExtrusionGroundEffectVert),
    hillshadePrepare: compile(hillshadePrepareFrag, hillshadePrepareVert),
    hillshade: compile(hillshadeFrag, hillshadeVert),
    line: compile(lineFrag, lineVert),
    linePattern: compile(linePatternFrag, linePatternVert),
    raster: compile(rasterFrag, rasterVert),
    rasterParticle: compile(rasterParticleFrag, rasterParticleVert),
    rasterParticleDraw: compile(rasterParticleDrawFrag, rasterParticleDrawVert),
    rasterParticleTexture: compile(rasterParticleTextureFrag, rasterParticleTextureVert),
    rasterParticleUpdate: compile(rasterParticleUpdateFrag, rasterParticleUpdateVert),
    symbol: compile(symbolFrag, symbolVert),
    terrainRaster: compile(terrainRasterFrag, terrainRasterVert),
    terrainDepth: compile(terrainDepthFrag, terrainDepthVert),
    skybox: compile(skyboxFrag, skyboxVert),
    skyboxGradient: compile(skyboxGradientFrag, skyboxVert),
    skyboxCapture: compile(skyboxCaptureFrag, skyboxCaptureVert),
    globeRaster: compile(globeFrag, globeVert),
    globeAtmosphere: compile(atmosphereFrag, atmosphereVert),
    model: compile(modelFrag, modelVert),
    modelDepth: compile(modelDepthFrag, modelDepthVert),
    stars: compile(starsFrag, starsVert),
    snowParticle: compile(snowFrag, snowVert),
    rainParticle: compile(rainFrag, rainVert),
    vignette: compile(vignetteFrag, vignetteVert),
    occlusion: compile(occlusionFrag, occlusionVert)
} as const;

export function parseUsedPreprocessorDefines(source: string, defines: Set<DynamicDefinesType>): void {
    const lines = source.split('\n');
    for (let line of lines) {
        line = line.trimStart();
        if (line[0] !== '#') continue;

        if (!line.includes('if')) continue;
        if (line.startsWith('#endif')) continue;

        const matches = line.match(IDENTIFIER_REGEX);
        if (!matches) continue;

        for (const match of matches) {
            if (!PREPROCESSOR_KEYWORDS.has(match)) {
                defines.add(match as DynamicDefinesType);
            }
        }
    }
}

// Expand #pragmas to #ifdefs.
export function compile(fragmentSource: string, vertexSource: string): ShaderSource {
    const fragmentPragmas: Set<string> = new Set();
    const vertexIncludes: string[] = [];
    const fragmentIncludes: string[] = [];

    fragmentSource = fragmentSource.replace(INCLUDE_REGEX, (_, name: string) => {
        fragmentIncludes.push(name);
        return '';
    });

    vertexSource = vertexSource.replace(INCLUDE_REGEX, (_, name: string) => {
        vertexIncludes.push(name);
        return '';
    });

    assert(!vertexSource.includes('flat out'), 'The usage of "flat" qualifier is disallowed, see: https://bugs.webkit.org/show_bug.cgi?id=268071');

    let usedDefines: Set<DynamicDefinesType> = new Set(commonDefines);
    parseUsedPreprocessorDefines(fragmentSource, usedDefines);
    parseUsedPreprocessorDefines(vertexSource, usedDefines);

    for (const includePath of [...vertexIncludes, ...fragmentIncludes]) {
        assert(includeMap[includePath], `Unknown include: ${includePath}`);

        if (!defineMap[includePath]) {
            defineMap[includePath] = new Set();
            parseUsedPreprocessorDefines(includeMap[includePath], defineMap[includePath]);
        }

        usedDefines = new Set([...usedDefines, ...defineMap[includePath]]);
    }

    fragmentSource = fragmentSource.replace(PRAGMA_REGEX, (_, operation, precision, type, name: string) => {
        fragmentPragmas.add(name);
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
in ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
        } else if (operation === 'initialize') {
            return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
        } else if (operation === 'define-attribute') {
            return `
#ifdef HAS_ATTRIBUTE_a_${name}
    in ${precision} ${type} ${name};
#endif
`;
        } else if (operation === 'initialize-attribute') {
            return '';
        }
    });

    vertexSource = vertexSource.replace(PRAGMA_REGEX, (_, operation, precision, type: string, name: string) => {

        const materialOffsetNameDefineName = `MATERIAL_ATTRIBUTE_OFFSET_${name}`;
        const attrType = type === 'float' ? 'vec2' : type;
        const materialAttribExpression = `GET_ATTRIBUTE_${attrType}(a_${name}, materialInfo, ${materialOffsetNameDefineName})`;
        const unpackType = name.match(/color/) ? 'color' : attrType;

        if (operation === 'define-attribute-vertex-shader-only') {
            return `
#ifdef HAS_ATTRIBUTE_a_${name}
in ${precision} ${type} a_${name};
#endif
`;
        } else if (fragmentPragmas.has(name)) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
    #if !defined(${materialOffsetNameDefineName})
        in ${precision} ${attrType} a_${name};
    #endif
out ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else if (operation === 'initialize') {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else {
                    return `
#if !defined(HAS_UNIFORM_u_${name})
    #ifdef ${materialOffsetNameDefineName}
        ${name} = unpack_mix_${unpackType}(${materialAttribExpression}, u_${name}_t);
    #else
        ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
    #endif
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            } else if (operation === 'define-attribute') {
                return `
#ifdef HAS_ATTRIBUTE_a_${name}
    in ${precision} ${type} a_${name};
    out ${precision} ${type} ${name};
#endif
`;
            } else if (operation === 'initialize-attribute') {
                return `
#ifdef HAS_ATTRIBUTE_a_${name}
    ${name} = a_${name};
#endif
`;
            }
        } else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
    #if !defined(${materialOffsetNameDefineName})
        in ${precision} ${attrType} a_${name};
    #endif
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else if (operation === 'define-instanced') {
                if (unpackType === 'mat4') {
                    return `
#ifdef INSTANCED_ARRAYS
in vec4 a_${name}0;
in vec4 a_${name}1;
in vec4 a_${name}2;
in vec4 a_${name}3;
#else
uniform ${precision} ${type} u_${name};
#endif
`;
                } else {
                    return `
#ifdef INSTANCED_ARRAYS
in ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
                }
            } else if (operation === 'initialize-attribute-custom') {
                return `
#ifdef HAS_ATTRIBUTE_a_${name}
    ${precision} ${type} ${name} = a_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    #ifdef ${materialOffsetNameDefineName}
        ${precision} ${type} ${name} = ${materialAttribExpression};
    #else
        ${precision} ${type} ${name} = a_${name};
    #endif
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else /* */ {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    #ifdef ${materialOffsetNameDefineName}
        ${precision} ${type} ${name} = unpack_mix_${unpackType}(${materialAttribExpression}, u_${name}_t);
    #else
        ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
    #endif
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
    });

    return {fragmentSource, vertexSource, usedDefines, vertexIncludes, fragmentIncludes};
}
