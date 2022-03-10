// @flow

import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
    Uniform1f,
    UniformMatrix3f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_proj_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_image0': Uniform1i,
    'u_grid_matrix': UniformMatrix3f
|};

export type AtmosphereUniformsType = {|
    'u_frustum_tl': Uniform3f,
    'u_frustum_tr': Uniform3f,
    'u_frustum_br': Uniform3f,
    'u_frustum_bl': Uniform3f,
    'u_globe_pos': Uniform3f,
    'u_globe_radius': Uniform1f,
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
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_grid_matrix': new UniformMatrix3f(context, locations.u_grid_matrix)
});

const atmosphereUniforms = (context: Context, locations: UniformLocations): AtmosphereUniformsType => ({
    'u_frustum_tl': new Uniform3f(context, locations.u_frustum_tl),
    'u_frustum_tr': new Uniform3f(context, locations.u_frustum_tr),
    'u_frustum_br': new Uniform3f(context, locations.u_frustum_br),
    'u_frustum_bl': new Uniform3f(context, locations.u_frustum_bl),
    'u_globe_pos': new Uniform3f(context, locations.u_globe_pos),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
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
    mercCenter: [number, number],
    gridMatrix: ?Array<number>
): UniformValues<GlobeRasterUniformsType> => ({
    'u_proj_matrix': Float32Array.from(projMatrix),
    'u_globe_matrix': globeMatrix,
    'u_merc_matrix': globeMercatorMatrix,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercCenter,
    'u_image0': 0,
    'u_grid_matrix': gridMatrix ? Float32Array.from(gridMatrix) : new Float32Array(9)
});

const atmosphereUniformValues = (
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    globePosition: [number, number, number],
    globeRadius: number,
    opacity: number,
    fadeoutRange: number,
    startColor: [number, number, number],
    endColor: [number, number, number]
): UniformValues<AtmosphereUniformsType> => ({
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_globe_pos': globePosition,
    'u_globe_radius': globeRadius,
    'u_opacity': opacity,
    'u_fadeout_range': fadeoutRange,
    'u_start_color': startColor,
    'u_end_color': endColor
});

export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues};

export type GlobeDefinesType = 'PROJECTION_GLOBE_VIEW' | 'GLOBE_POLES';
