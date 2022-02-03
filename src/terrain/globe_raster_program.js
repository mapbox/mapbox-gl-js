// @flow

import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    Uniform1f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_proj_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_image0': Uniform1i
|};

export type AtmosphereUniformsType = {|
    'u_center': Uniform2f,
    'u_radius': Uniform1f,
    'u_screen_size': Uniform2f,
    'u_pixel_ratio': Uniform1f,
    'u_opacity': Uniform1f,
    'u_fadeout_range': Uniform1f,
    'u_start_color': Uniform3f,
    'u_end_color': Uniform3f
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_proj_matrix': new UniformMatrix4f(context, locations.u_proj_matrix),
    'u_globe_matrix': new UniformMatrix4f(context, locations.u_globe_matrix),
    'u_merc_matrix': new UniformMatrix4f(context, locations.u_merc_matrix),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_image0': new Uniform1i(context, locations.u_image0)
});

const atmosphereUniforms = (context: Context, locations: UniformLocations): AtmosphereUniformsType => ({
    'u_center': new Uniform2f(context, locations.u_center),
    'u_radius': new Uniform1f(context, locations.u_radius),
    'u_screen_size': new Uniform2f(context, locations.u_screen_size),
    'u_pixel_ratio': new Uniform1f(context, locations.u_pixel_ratio),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_fadeout_range': new Uniform1f(context, locations.u_fadeout_range),
    'u_start_color': new Uniform3f(context, locations.u_start_color),
    'u_end_color': new Uniform3f(context, locations.u_end_color)
});

const globeRasterUniformValues = (
    projMatrix: Array<number>,
    globeMatrix: Float32Array,
    globeMercatorMatrix: Float32Array,
    zoomTransition: number,
    mercCenter: [number, number]
): UniformValues<GlobeRasterUniformsType> => ({
    'u_proj_matrix': Float32Array.from(projMatrix),
    'u_globe_matrix': globeMatrix,
    'u_merc_matrix': globeMercatorMatrix,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercCenter,
    'u_image0': 0
});

const atmosphereUniformValues = (
    center: [number, number],
    radius: number,
    screenSize: [number, number],
    pixelRatio: number,
    opacity: number,
    fadeoutRange: number,
    startColor: [number, number, number],
    endColor: [number, number, number]
): UniformValues<AtmosphereUniformsType> => ({
    'u_center': center,
    'u_radius': radius,
    'u_screen_size': screenSize,
    'u_pixel_ratio': pixelRatio,
    'u_opacity': opacity,
    'u_fadeout_range': fadeoutRange,
    'u_start_color': startColor,
    'u_end_color': endColor,
});

export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues};
