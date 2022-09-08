
// Disable Flow annotations here because Flow doesn't support importing GLSL files
/* eslint-disable flowtype/require-valid-file-annotation */

import preludeCommon from './_prelude.glsl';
import preludeFrag from './_prelude.fragment.glsl';
import preludeVert from './_prelude.vertex.glsl';
import backgroundFrag from './background.fragment.glsl';
import backgroundVert from './background.vertex.glsl';
import backgroundPatternFrag from './background_pattern.fragment.glsl';
import backgroundPatternVert from './background_pattern.vertex.glsl';
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
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl';
import hillshadeFrag from './hillshade.fragment.glsl';
import hillshadeVert from './hillshade.vertex.glsl';
import lineFrag from './line.fragment.glsl';
import lineVert from './line.vertex.glsl';
import linePatternFrag from './line_pattern.fragment.glsl';
import linePatternVert from './line_pattern.vertex.glsl';
import rasterFrag from './raster.fragment.glsl';
import rasterVert from './raster.vertex.glsl';
import symbolIconFrag from './symbol_icon.fragment.glsl';
import symbolIconVert from './symbol_icon.vertex.glsl';
import symbolSDFFrag from './symbol_sdf.fragment.glsl';
import symbolSDFVert from './symbol_sdf.vertex.glsl';
import symbolTextAndIconFrag from './symbol_text_and_icon.fragment.glsl';
import symbolTextAndIconVert from './symbol_text_and_icon.vertex.glsl';
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
import skyboxCaptureFrag from './skybox_capture.fragment.glsl';
import skyboxCaptureVert from './skybox_capture.vertex.glsl';
import globeFrag from './globe_raster.fragment.glsl';
import globeVert from './globe_raster.vertex.glsl';
import atmosphereFrag from './atmosphere.fragment.glsl';
import atmosphereVert from './atmosphere.vertex.glsl';

export let preludeTerrain = {};
export let preludeFog = {};

const commonDefines = [];
parseUsedPreprocessorDefines(preludeCommon, commonDefines);
parseUsedPreprocessorDefines(preludeTerrainVert, commonDefines);
parseUsedPreprocessorDefines(preludeFogVert, commonDefines);
parseUsedPreprocessorDefines(preludeFogFrag, commonDefines);

preludeTerrain = compile('', preludeTerrainVert);
preludeFog = compile(preludeFogFrag, preludeFogVert);
// Shadow prelude is not compiled until GL-JS implements shadows

export const prelude = compile(preludeFrag, preludeVert);
export const preludeCommonSource = preludeCommon;

export const preludeVertPrecisionQualifiers = `
#ifdef GL_ES
precision highp float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif`;
export const preludeFragPrecisionQualifiers = `
#ifdef GL_ES
precision mediump float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif`;

export const standardDerivativesExt = '#extension GL_OES_standard_derivatives : enable\n';

export default {
    background: compile(backgroundFrag, backgroundVert),
    backgroundPattern: compile(backgroundPatternFrag, backgroundPatternVert),
    circle: compile(circleFrag, circleVert),
    clippingMask: compile(clippingMaskFrag, clippingMaskVert),
    heatmap: compile(heatmapFrag, heatmapVert),
    heatmapTexture: compile(heatmapTextureFrag, heatmapTextureVert),
    collisionBox: compile(collisionBoxFrag, collisionBoxVert),
    collisionCircle: compile(collisionCircleFrag, collisionCircleVert),
    debug: compile(debugFrag, debugVert),
    fill: compile(fillFrag, fillVert),
    fillOutline: compile(fillOutlineFrag, fillOutlineVert),
    fillOutlinePattern: compile(fillOutlinePatternFrag, fillOutlinePatternVert),
    fillPattern: compile(fillPatternFrag, fillPatternVert),
    fillExtrusion: compile(fillExtrusionFrag, fillExtrusionVert),
    fillExtrusionPattern: compile(fillExtrusionPatternFrag, fillExtrusionPatternVert),
    hillshadePrepare: compile(hillshadePrepareFrag, hillshadePrepareVert),
    hillshade: compile(hillshadeFrag, hillshadeVert),
    line: compile(lineFrag, lineVert),
    linePattern: compile(linePatternFrag, linePatternVert),
    raster: compile(rasterFrag, rasterVert),
    symbolIcon: compile(symbolIconFrag, symbolIconVert),
    symbolSDF: compile(symbolSDFFrag, symbolSDFVert),
    symbolTextAndIcon: compile(symbolTextAndIconFrag, symbolTextAndIconVert),
    terrainRaster: compile(terrainRasterFrag, terrainRasterVert),
    terrainDepth: compile(terrainDepthFrag, terrainDepthVert),
    skybox: compile(skyboxFrag, skyboxVert),
    skyboxGradient: compile(skyboxGradientFrag, skyboxVert),
    skyboxCapture: compile(skyboxCaptureFrag, skyboxCaptureVert),
    globeRaster: compile(globeFrag, globeVert),
    globeAtmosphere: compile(atmosphereFrag, atmosphereVert)
};

export function parseUsedPreprocessorDefines(source, defines) {
    const lines = source.replace(/\s*\/\/[^\n]*\n/g, '\n').split('\n');
    for (let line of lines) {
        line = line.trim();
        if (line[0] === '#') {
            if (line.includes('if') && !line.includes('endif')) {
                line = line.replace('#', '')
                    .replace(/ifdef|ifndef|elif|if/g, '')
                    .replace(/!|defined|\(|\)|\|\||&&/g, '')
                    .replace(/\s+/g, ' ').trim();

                const newDefines = line.split(' ');
                for (const define of newDefines) {
                    if (!defines.includes(define)) {
                        defines.push(define);
                    }
                }
            }
        }
    }
}

// Expand #pragmas to #ifdefs.
export function compile(fragmentSource, vertexSource) {
    const pragmaRegex = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;
    const attributeRegex = /attribute (highp |mediump |lowp )?([\w]+) ([\w]+)/g;

    const staticAttributes = vertexSource.match(attributeRegex);
    const fragmentPragmas = {};

    const usedDefines = [...commonDefines];
    parseUsedPreprocessorDefines(fragmentSource, usedDefines);
    parseUsedPreprocessorDefines(vertexSource, usedDefines);

    fragmentSource = fragmentSource.replace(pragmaRegex, (match, operation, precision, type, name) => {
        fragmentPragmas[name] = true;
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
        } else /* if (operation === 'initialize') */ {
            return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
        }
    });

    vertexSource = vertexSource.replace(pragmaRegex, (match, operation, precision, type, name) => {
        const attrType = type === 'float' ? 'vec2' : 'vec4';
        const unpackType = name.match(/color/) ? 'color' : attrType;

        if (fragmentPragmas[name]) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
attribute ${precision} ${attrType} a_${name};
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
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
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        } else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
attribute ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else /* */{
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
    });

    return {fragmentSource, vertexSource, staticAttributes, usedDefines};
}
