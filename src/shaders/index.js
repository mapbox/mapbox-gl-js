// @flow

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
import extrusionTextureFrag from './extrusion_texture.fragment.glsl';
import extrusionTextureVert from './extrusion_texture.vertex.glsl';
import hillshadePrepareFrag from './hillshade_prepare.fragment.glsl';
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl';
import hillshadeFrag from './hillshade.fragment.glsl';
import hillshadeVert from './hillshade.vertex.glsl';
import lineFrag from './line.fragment.glsl';
import lineVert from './line.vertex.glsl';
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

const shaders: {[string]: {fragmentSource: string, vertexSource: string}} = {
    prelude: {
        fragmentSource: preludeFrag,
        vertexSource: preludeVert
    },
    background: {
        fragmentSource: backgroundFrag,
        vertexSource: backgroundVert
    },
    backgroundPattern: {
        fragmentSource: backgroundPatternFrag,
        vertexSource: backgroundPatternVert
    },
    circle: {
        fragmentSource: circleFrag,
        vertexSource: circleVert
    },
    clippingMask: {
        fragmentSource: clippingMaskFrag,
        vertexSource: clippingMaskVert
    },
    heatmap: {
        fragmentSource: heatmapFrag,
        vertexSource: heatmapVert
    },
    heatmapTexture: {
        fragmentSource: heatmapTextureFrag,
        vertexSource: heatmapTextureVert
    },
    collisionBox: {
        fragmentSource: collisionBoxFrag,
        vertexSource: collisionBoxVert
    },
    collisionCircle: {
        fragmentSource: collisionCircleFrag,
        vertexSource: collisionCircleVert
    },
    debug: {
        fragmentSource: debugFrag,
        vertexSource: debugVert
    },
    fill: {
        fragmentSource: fillFrag,
        vertexSource: fillVert
    },
    fillOutline: {
        fragmentSource: fillOutlineFrag,
        vertexSource: fillOutlineVert
    },
    fillOutlinePattern: {
        fragmentSource: fillOutlinePatternFrag,
        vertexSource: fillOutlinePatternVert
    },
    fillPattern: {
        fragmentSource: fillPatternFrag,
        vertexSource: fillPatternVert
    },
    fillExtrusion: {
        fragmentSource: fillExtrusionFrag,
        vertexSource: fillExtrusionVert
    },
    fillExtrusionPattern: {
        fragmentSource: fillExtrusionPatternFrag,
        vertexSource: fillExtrusionPatternVert
    },
    extrusionTexture: {
        fragmentSource: extrusionTextureFrag,
        vertexSource: extrusionTextureVert
    },
    hillshadePrepare: {
        fragmentSource: hillshadePrepareFrag,
        vertexSource: hillshadePrepareVert
    },
    hillshade: {
        fragmentSource: hillshadeFrag,
        vertexSource: hillshadeVert
    },
    line: {
        fragmentSource: lineFrag,
        vertexSource: lineVert
    },
    linePattern: {
        fragmentSource: linePatternFrag,
        vertexSource: linePatternVert
    },
    lineSDF: {
        fragmentSource: lineSDFFrag,
        vertexSource: lineSDFVert
    },
    raster: {
        fragmentSource: rasterFrag,
        vertexSource: rasterVert
    },
    symbolIcon: {
        fragmentSource: symbolIconFrag,
        vertexSource: symbolIconVert
    },
    symbolSDF: {
        fragmentSource: symbolSDFFrag,
        vertexSource: symbolSDFVert
    }
};

// Expand #pragmas to #ifdefs.

const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;

for (const programName in shaders) {
    const program = shaders[programName];
    const fragmentPragmas: {[string]: boolean} = {};

    program.fragmentSource = program.fragmentSource.replace(re, (match: string, operation: string, precision: string, type: string, name: string) => {
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

    program.vertexSource = program.vertexSource.replace(re, (match: string, operation: string, precision: string, type: string, name: string) => {
        const attrType = type === 'float' ? 'vec2' : 'vec4';
        if (fragmentPragmas[name]) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${attrType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
            }
        } else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float a_${name}_t;
attribute ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${attrType}(a_${name}, a_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
            }
        }
    });
}

export default shaders;
