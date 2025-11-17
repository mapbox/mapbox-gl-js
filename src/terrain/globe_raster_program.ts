import {
    Uniform1i,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformMatrix4f,
    Uniform1f,
    UniformMatrix3f,
} from '../render/uniform_binding';

import type Context from '../gl/context';
import type {UniformValues} from '../render/uniform_binding';
import type {mat4} from 'gl-matrix';
import type {NonPremultipliedRenderColor} from '../style-spec/util/color';

export type GlobeRasterUniformsType = {
    ['u_proj_matrix']: UniformMatrix4f;
    ['u_globe_matrix']: UniformMatrix4f;
    ['u_normalize_matrix']: UniformMatrix4f;
    ['u_merc_matrix']: UniformMatrix4f;
    ['u_zoom_transition']: Uniform1f;
    ['u_merc_center']: Uniform2f;
    ['u_image0']: Uniform1i;
    ['u_image1']: Uniform1i;
    ['u_grid_matrix']: UniformMatrix3f;
    ['u_skirt_height']: Uniform1f;
    ['u_far_z_cutoff']: Uniform1f;
    ['u_frustum_tl']: Uniform3f;
    ['u_frustum_tr']: Uniform3f;
    ['u_frustum_br']: Uniform3f;
    ['u_frustum_bl']: Uniform3f;
    ['u_globe_pos']: Uniform3f;
    ['u_globe_radius']: Uniform1f;
    ['u_viewport']: Uniform2f;
    ['u_emissive_texture_available']: Uniform1f;
};

export type AtmosphereUniformsType = {
    ['u_frustum_tl']: Uniform3f;
    ['u_frustum_tr']: Uniform3f;
    ['u_frustum_br']: Uniform3f;
    ['u_frustum_bl']: Uniform3f;
    ['u_horizon']: Uniform1f;
    ['u_transition']: Uniform1f;
    ['u_fadeout_range']: Uniform1f;
    ['u_atmosphere_fog_color']: Uniform4f;
    ['u_high_color']: Uniform4f;
    ['u_space_color']: Uniform4f;
    ['u_temporal_offset']: Uniform1f;
    ['u_horizon_angle']: Uniform1f;
};

const globeRasterUniforms = (context: Context): GlobeRasterUniformsType => ({
    'u_proj_matrix': new UniformMatrix4f(context),
    'u_globe_matrix': new UniformMatrix4f(context),
    'u_normalize_matrix': new UniformMatrix4f(context),
    'u_merc_matrix': new UniformMatrix4f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_merc_center': new Uniform2f(context),
    'u_image0': new Uniform1i(context),
    'u_image1': new Uniform1i(context),
    'u_grid_matrix': new UniformMatrix3f(context),
    'u_skirt_height': new Uniform1f(context),
    'u_far_z_cutoff': new Uniform1f(context),
    'u_frustum_tl': new Uniform3f(context),
    'u_frustum_tr': new Uniform3f(context),
    'u_frustum_br': new Uniform3f(context),
    'u_frustum_bl': new Uniform3f(context),
    'u_globe_pos': new Uniform3f(context),
    'u_globe_radius': new Uniform1f(context),
    'u_viewport': new Uniform2f(context),
    'u_emissive_texture_available': new Uniform1f(context)
});

const atmosphereUniforms = (context: Context): AtmosphereUniformsType => ({
    'u_frustum_tl': new Uniform3f(context),
    'u_frustum_tr': new Uniform3f(context),
    'u_frustum_br': new Uniform3f(context),
    'u_frustum_bl': new Uniform3f(context),
    'u_horizon': new Uniform1f(context),
    'u_transition': new Uniform1f(context),
    'u_fadeout_range': new Uniform1f(context),
    'u_atmosphere_fog_color': new Uniform4f(context),
    'u_high_color': new Uniform4f(context),
    'u_space_color': new Uniform4f(context),
    'u_temporal_offset': new Uniform1f(context),
    'u_horizon_angle': new Uniform1f(context),
});

const globeRasterUniformValues = (
    projMatrix: mat4,
    globeMatrix: mat4,
    globeMercatorMatrix: mat4,
    normalizeMatrix: mat4,
    zoomTransition: number,
    mercCenter: [number, number],
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    globePosition: [number, number, number],
    globeRadius: number,
    viewport: [number, number],
    skirtHeight: number,
    farZCutoff: number,
    emissiveTextureAvailable: number,
    gridMatrix?: mat4 | null,
): UniformValues<GlobeRasterUniformsType> => ({
    'u_proj_matrix': Float32Array.from(projMatrix),
    'u_globe_matrix': globeMatrix as Float32Array,
    'u_normalize_matrix': Float32Array.from(normalizeMatrix),
    'u_merc_matrix': globeMercatorMatrix as Float32Array,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercCenter,
    'u_image0': 0,
    'u_image1': 1,
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_globe_pos': globePosition,
    'u_globe_radius': globeRadius,
    'u_viewport': viewport,
    'u_grid_matrix': gridMatrix ? Float32Array.from(gridMatrix) : new Float32Array(9),
    'u_skirt_height': skirtHeight,
    'u_far_z_cutoff': farZCutoff,
    'u_emissive_texture_available': emissiveTextureAvailable
});

const atmosphereUniformValues = (
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    horizon: number,
    transitionT: number,
    fadeoutRange: number,
    atmosphereFogColor: NonPremultipliedRenderColor,
    highColor: NonPremultipliedRenderColor,
    spaceColor: NonPremultipliedRenderColor,
    temporalOffset: number,
    horizonAngle: number,
): UniformValues<AtmosphereUniformsType> => ({
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_horizon': horizon,
    'u_transition': transitionT,
    'u_fadeout_range': fadeoutRange,
    'u_atmosphere_fog_color': atmosphereFogColor.toArray01(),
    'u_high_color': highColor.toArray01(),
    'u_space_color': spaceColor.toArray01(),
    'u_temporal_offset': temporalOffset,
    'u_horizon_angle': horizonAngle
});

export {globeRasterUniforms, globeRasterUniformValues, atmosphereUniforms, atmosphereUniformValues};

export type GlobeDefinesType = 'PROJECTION_GLOBE_VIEW' | 'GLOBE_POLES' | 'CUSTOM_ANTIALIASING' | 'ALPHA_PASS';
