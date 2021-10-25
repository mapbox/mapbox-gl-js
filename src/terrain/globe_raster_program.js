// @flow

import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    Uniform1f,
    Uniform4f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_proj_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_up_vector_matrix': UniformMatrix4f,
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

export type StarsUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_opacity': Uniform1f,
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_proj_matrix': new UniformMatrix4f(context, locations.u_proj_matrix),
    'u_globe_matrix': new UniformMatrix4f(context, locations.u_globe_matrix),
    'u_merc_matrix': new UniformMatrix4f(context, locations.u_merc_matrix),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_up_vector_matrix': new UniformMatrix4f(context, locations.u_up_vector_matrix),
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
    'u_end_color': new Uniform3f(context, locations.u_end_color),

    'u_globe_center': new Uniform3f(context, locations.u_globe_center),
    'u_camera_pos': new Uniform3f(context, locations.u_camera_pos),
    'u_camera_dir': new Uniform3f(context, locations.u_camera_dir),
    'u_tl': new Uniform3f(context, locations.u_tl),
    'u_right': new Uniform3f(context, locations.u_right),
    'u_down': new Uniform3f(context, locations.u_down),
    'u_radius2': new Uniform1f(context, locations.u_radius2),
    'u_light_dir': new Uniform3f(context, locations.u_light_dir),
});

const starsUniforms = (context: Context, locations: UniformLocations): AtmosphereUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const globeRasterUniformValues = (
    projMatrix: Float32Array,
    globeMatrix: Float32Array,
    globeMercatorMatrix: Float32Array,
    zoomTransition: number,
    mercCenter: [number, number],
    upVectorMatrix: Float32Array
): UniformValues<GlobeRasterUniformsType> => ({
    'u_proj_matrix': projMatrix,
    'u_globe_matrix': globeMatrix,
    'u_merc_matrix': globeMercatorMatrix,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercCenter,
    'u_up_vector_matrix': upVectorMatrix,
    'u_image0': 0
});

const atmosphereUniformValues = (
    center,
    radius,
    screenSize,
    pixelRatio,
    opacity,
    fadeoutRange,
    startColor,
    endColor,
    globePos,
    cameraPos,
    cameraDir,
    tl,
    right,
    down,
    radius2,
    lightDir
): UniformValues<AtmosphereUniformsType> => ({
    'u_center': center,
    'u_radius': radius,
    'u_screen_size': screenSize,
    'u_pixel_ratio': pixelRatio,
    'u_opacity': opacity,
    'u_fadeout_range': fadeoutRange,
    'u_start_color': startColor,
    'u_end_color': endColor,

    'u_globe_center': globePos,
    'u_camera_pos': cameraPos,
    'u_camera_dir': cameraDir,
    'u_tl': tl,
    'u_right': right,
    'u_down': down,
    'u_radius2': radius2,
    'u_light_dir': lightDir
});

const starsUniformValues = (
    matrix,
    opacity
): UniformValues<StarsUniformsType> => ({
    'u_matrix': matrix,
    'u_opacity': opacity
});


export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues, starsUniforms, starsUniformValues};
