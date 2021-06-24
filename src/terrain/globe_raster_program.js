// @flow

import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    Uniform1f,
    Uniform4f
} from '../render/uniform_binding.js';

/*
uniform float u_opacity;
uniform float u_gradient_size;
uniform vec4 u_start_color;
uniform vec4 u_end_color;
*/

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_globe_matrix': UniformMatrix4f,
    'u_mercator_matrix': UniformMatrix4f,
    'u_transition_lerp': Uniform1f,
    'u_image0': Uniform1i,
    'u_tl_normal': Uniform3f,
    'u_tr_normal': Uniform3f,
    'u_br_normal': Uniform3f,
    'u_bl_normal': Uniform3f,
    'u_top_meters_to_pixels': Uniform1f,
    'u_bottom_meters_to_pixels': Uniform1f,
|};

export type AtmosphereUniformsType = {|
    'u_center': Uniform2f,
    'u_radius': Uniform1f,
    'u_screen_size': Uniform2f,
    'u_opacity': Uniform1f,
    'u_fadeout_range': Uniform1f,
    'u_start_color': Uniform3f,
    'u_end_color': Uniform3f
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_globe_matrix': new UniformMatrix4f(context, locations.u_globe_matrix),
    'u_mercator_matrix': new UniformMatrix4f(context, locations.u_mercator_matrix),
    'u_transition_lerp': new Uniform1f(context, locations.u_transition_lerp),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_tl_normal': new Uniform3f(context, locations.u_tl_normal),
    'u_tr_normal': new Uniform3f(context, locations.u_tr_normal),
    'u_br_normal': new Uniform3f(context, locations.u_br_normal),
    'u_bl_normal': new Uniform3f(context, locations.u_bl_normal),
    'u_top_meters_to_pixels': new Uniform1f(context, locations.u_top_meters_to_pixels),
    'u_bottom_meters_to_pixels': new Uniform1f(context, locations.u_bottom_meters_to_pixels)
});

const atmosphereUniforms = (context: Context, locations: UniformLocations): AtmosphereUniformsType => ({
    'u_center': new Uniform2f(context, locations.u_center),
    'u_radius': new Uniform1f(context, locations.u_radius),
    'u_screen_size': new Uniform2f(context, locations.u_screen_size),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_fadeout_range': new Uniform1f(context, locations.u_fadeout_range),
    'u_start_color': new Uniform3f(context, locations.u_start_color),
    'u_end_color': new Uniform3f(context, locations.u_end_color)
});

/*
uniform mat4 u_globe_matrix;
uniform mat4 u_mercator_matrix;
uniform float u_transition_lerp;
*/

const globeRasterUniformValues = (
    globeMatrix: Float32Array,
    mercMatrix: Float32Array,
    transitionLerp,
    tlNormal,
    trNormal,
    brNormal,
    blNormal,
    topMetersToPixels,
    bottomMetersToPixels
): UniformValues<GlobeRasterUniformsType> => ({
    'u_globe_matrix': globeMatrix,
    'u_mercator_matrix': mercMatrix,
    'u_transition_lerp': transitionLerp,
    'u_image0': 0,
    'u_tl_normal': tlNormal,
    'u_tr_normal': trNormal,
    'u_br_normal': brNormal,
    'u_bl_normal': blNormal,
    'u_top_meters_to_pixels': topMetersToPixels,
    'u_bottom_meters_to_pixels': bottomMetersToPixels
});

const atmosphereUniformValues = (
    center,
    radius,
    screenSize,
    opacity,
    fadeoutRange,
    startColor,
    endColor
): UniformValues<AtmosphereUniformsType> => ({
    'u_center': center,
    'u_radius': radius,
    'u_screen_size': screenSize,
    'u_opacity': opacity,
    'u_fadeout_range': fadeoutRange,
    'u_start_color': startColor,
    'u_end_color': endColor,
});

export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues};
