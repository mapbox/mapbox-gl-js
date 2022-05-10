// @flow

import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformMatrix4f,
    Uniform1f,
    UniformMatrix3f
} from '../render/uniform_binding.js';
import browser from '../util/browser.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_proj_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_normalize_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_image0': Uniform1i,
    'u_grid_matrix': UniformMatrix3f,
    'u_frustum_tl': Uniform3f,
    'u_frustum_tr': Uniform3f,
    'u_frustum_br': Uniform3f,
    'u_frustum_bl': Uniform3f,
    'u_globe_pos': Uniform3f,
    'u_globe_radius': Uniform1f,
    'u_viewport': Uniform2f
|};

export type AtmosphereUniformsType = {|
    'u_frustum_tl': Uniform3f,
    'u_frustum_tr': Uniform3f,
    'u_frustum_br': Uniform3f,
    'u_frustum_bl': Uniform3f,
    'u_horizon': Uniform1f,
    'u_transition': Uniform1f,
    'u_fadeout_range': Uniform1f,
    'u_color': Uniform4f,
    'u_high_color': Uniform4f,
    'u_space_color': Uniform4f,
    'u_star_intensity': Uniform1f,
    'u_star_size': Uniform1f,
    'u_star_density': Uniform1f,
    'u_temporal_offset': Uniform1f,
    'u_horizon_angle': Uniform1f,
    'u_rotation_matrix': UniformMatrix4f
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_proj_matrix': new UniformMatrix4f(context, locations.u_proj_matrix),
    'u_globe_matrix': new UniformMatrix4f(context, locations.u_globe_matrix),
    'u_normalize_matrix': new UniformMatrix4f(context, locations.u_normalize_matrix),
    'u_merc_matrix': new UniformMatrix4f(context, locations.u_merc_matrix),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_grid_matrix': new UniformMatrix3f(context, locations.u_grid_matrix),
    'u_frustum_tl': new Uniform3f(context, locations.u_frustum_tl),
    'u_frustum_tr': new Uniform3f(context, locations.u_frustum_tr),
    'u_frustum_br': new Uniform3f(context, locations.u_frustum_br),
    'u_frustum_bl': new Uniform3f(context, locations.u_frustum_bl),
    'u_globe_pos': new Uniform3f(context, locations.u_globe_pos),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
    'u_viewport': new Uniform2f(context, locations.u_viewport)
});

const atmosphereUniforms = (context: Context, locations: UniformLocations): AtmosphereUniformsType => ({
    'u_frustum_tl': new Uniform3f(context, locations.u_frustum_tl),
    'u_frustum_tr': new Uniform3f(context, locations.u_frustum_tr),
    'u_frustum_br': new Uniform3f(context, locations.u_frustum_br),
    'u_frustum_bl': new Uniform3f(context, locations.u_frustum_bl),
    'u_horizon': new Uniform1f(context, locations.u_horizon),
    'u_transition': new Uniform1f(context, locations.u_transition),
    'u_fadeout_range': new Uniform1f(context, locations.u_fadeout_range),
    'u_color': new Uniform4f(context, locations.u_color),
    'u_high_color': new Uniform4f(context, locations.u_high_color),
    'u_space_color': new Uniform4f(context, locations.u_space_color),
    'u_star_intensity': new Uniform1f(context, locations.u_star_intensity),
    'u_star_density': new Uniform1f(context, locations.u_star_density),
    'u_star_size': new Uniform1f(context, locations.u_star_size),
    'u_temporal_offset': new Uniform1f(context, locations.u_temporal_offset),
    'u_horizon_angle': new Uniform1f(context, locations.u_horizon_angle),
    'u_rotation_matrix': new UniformMatrix4f(context, locations.u_rotation_matrix)
});

const globeRasterUniformValues = (
    projMatrix: Array<number>,
    globeMatrix: Float32Array,
    globeMercatorMatrix: Float32Array,
    normalizeMatrix: Float64Array,
    zoomTransition: number,
    mercCenter: [number, number],
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    globePosition: [number, number, number],
    globeRadius: number,
    viewport: [number, number],
    gridMatrix: ?Array<number>
): UniformValues<GlobeRasterUniformsType> => ({
    'u_proj_matrix': Float32Array.from(projMatrix),
    'u_globe_matrix': globeMatrix,
    'u_normalize_matrix': Float32Array.from(normalizeMatrix),
    'u_merc_matrix': globeMercatorMatrix,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercCenter,
    'u_image0': 0,
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_globe_pos': globePosition,
    'u_globe_radius': globeRadius,
    'u_viewport': viewport,
    'u_grid_matrix': gridMatrix ? Float32Array.from(gridMatrix) : new Float32Array(9)
});

const atmosphereUniformValues = (
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    horizon: number,
    transitionT: number,
    fadeoutRange: number,
    color: [number, number, number, number],
    highColor: [number, number, number, number],
    spaceColor: [number, number, number, number],
    starIntensity: number,
    temporalOffset: number,
    horizonAngle: number,
    rotationMatrix: Float32Array
): UniformValues<AtmosphereUniformsType> => ({
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_horizon': horizon,
    'u_transition': transitionT,
    'u_fadeout_range': fadeoutRange,
    'u_color': color,
    'u_high_color': highColor,
    'u_space_color': spaceColor,
    'u_star_intensity': starIntensity,
    'u_star_size': 5.0 * browser.devicePixelRatio,
    'u_star_density': 0.0,
    'u_temporal_offset': temporalOffset,
    'u_horizon_angle': horizonAngle,
    'u_rotation_matrix': rotationMatrix
});

export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues};

export type GlobeDefinesType = 'PROJECTION_GLOBE_VIEW' | 'GLOBE_POLES' | 'CUSTOM_ANTIALIASING';
