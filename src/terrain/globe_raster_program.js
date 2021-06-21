// @flow

import {
    Uniform1i,
    Uniform3f,
    UniformMatrix4f,
    Uniform1f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image0': Uniform1i,
    'u_tl_normal': Uniform3f,
    'u_tr_normal': Uniform3f,
    'u_br_normal': Uniform3f,
    'u_bl_normal': Uniform3f,
    'u_top_meters_to_pixels': Uniform1f,
    'u_bottom_meters_to_pixels': Uniform1f,
    //'u_skirt_height': Uniform1f
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_tl_normal': new Uniform3f(context, locations.u_tl_normal),
    'u_tr_normal': new Uniform3f(context, locations.u_tr_normal),
    'u_br_normal': new Uniform3f(context, locations.u_br_normal),
    'u_bl_normal': new Uniform3f(context, locations.u_bl_normal),
    'u_top_meters_to_pixels': new Uniform1f(context, locations.u_top_meters_to_pixels),
    'u_bottom_meters_to_pixels': new Uniform1f(context, locations.u_bottom_meters_to_pixels)
    //'u_skirt_height': new Uniform1f(context, locations.u_skirt_height)
});

const globeRasterUniformValues = (
    matrix: Float32Array,
    tlNormal,
    trNormal,
    brNormal,
    blNormal,
    topMetersToPixels,
    bottomMetersToPixels
    //skirtHeight: number
): UniformValues<GlobeRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_image0': 0,
    'u_tl_normal': tlNormal,
    'u_tr_normal': trNormal,
    'u_br_normal': brNormal,
    'u_bl_normal': blNormal,
    'u_top_meters_to_pixels': topMetersToPixels,
    'u_bottom_meters_to_pixels': bottomMetersToPixels
    //'u_skirt_height': skirtHeight
});

export {globeRasterUniforms, globeRasterUniformValues};
