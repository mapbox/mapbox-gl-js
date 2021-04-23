
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
import lineGradientFrag from './line_gradient.fragment.glsl';
import lineGradientVert from './line_gradient.vertex.glsl';
import linePatternFrag from './line_pattern.fragment.glsl';
import linePatternVert from './line_pattern.vertex.glsl';
import lineSDFFrag from './line_sdf.fragment.glsl';
import lineSDFVert from './line_sdf.vertex.glsl';
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

export let preludeTerrain = {};
export let preludeFog = {};

preludeTerrain = compile('', preludeTerrainVert, true);
preludeFog = compile(preludeFogFrag, preludeFogVert, true);

export const prelude = compile(preludeFrag, preludeVert);
export const preludeCommonSource = preludeCommon;

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
    lineGradient: compile(lineGradientFrag, lineGradientVert),
    linePattern: compile(linePatternFrag, linePatternVert),
    lineSDF: compile(lineSDFFrag, lineSDFVert),
    raster: compile(rasterFrag, rasterVert),
    symbolIcon: compile(symbolIconFrag, symbolIconVert),
    symbolSDF: compile(symbolSDFFrag, symbolSDFVert),
    symbolTextAndIcon: compile(symbolTextAndIconFrag, symbolTextAndIconVert),
    terrainRaster: compile(terrainRasterFrag, terrainRasterVert),
    terrainDepth: compile(terrainDepthFrag, terrainDepthVert),
    skybox: compile(skyboxFrag, skyboxVert),
    skyboxGradient: compile(skyboxGradientFrag, skyboxVert),
    skyboxCapture: compile(skyboxCaptureFrag, skyboxCaptureVert)
};

// Expand #pragmas to #ifdefs.
function compile(fragmentSource, vertexSource, isGlobalPrelude) {
    const pragmaRegex = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;
    const uniformRegex = /uniform (highp |mediump |lowp )?([\w]+) ([\w]+)([\s]*)([\w]*)/g;
    const attributeRegex = /attribute (highp |mediump |lowp )?([\w]+) ([\w]+)/g;

    const staticAttributes = vertexSource.match(attributeRegex);
    const fragmentUniforms = fragmentSource.match(uniformRegex);
    const vertexUniforms = vertexSource.match(uniformRegex);
    const commonUniforms = preludeCommon.match(uniformRegex);

    let staticUniforms = vertexUniforms ? vertexUniforms.concat(fragmentUniforms) : fragmentUniforms;

    if (!isGlobalPrelude) {
        if (preludeTerrain.staticUniforms) {
            staticUniforms = preludeTerrain.staticUniforms.concat(staticUniforms);
        }
        if (preludeFog.staticUniforms) {
            staticUniforms = preludeFog.staticUniforms.concat(staticUniforms);
        }
    }

    if (staticUniforms) {
        staticUniforms = staticUniforms.concat(commonUniforms);
    }

    const fragmentPragmas = {};

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

    return {fragmentSource, vertexSource, staticAttributes, staticUniforms};
}
