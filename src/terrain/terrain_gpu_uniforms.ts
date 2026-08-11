// Terrain and Globe GPU uniform type definitions used by both core (Program class)
// and the terrain renderer (terrain.ts, which moves to lite).
// Keeping these definitions here (core) prevents terrain.ts from being pulled into
// the core bundle solely due to Program's need for the uniform constructors.

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f,
} from '../render/uniform_binding';

import type Context from '../gl/context';
import type {UniformValues} from '../render/uniform_binding';
import type {mat4} from 'gl-matrix';
import type Tile from '../source/tile';

export type TerrainUniformsType = {
    ['u_dem']: Uniform1i;
    ['u_dem_prev']: Uniform1i;
    ['u_dem_tl']: Uniform2f;
    ['u_dem_scale']: Uniform1f;
    ['u_dem_tl_prev']: Uniform2f;
    ['u_dem_scale_prev']: Uniform1f;
    ['u_dem_size']: Uniform1f;
    ['u_dem_lerp']: Uniform1f;
    ["u_exaggeration"]: Uniform1f;
    ['u_depth']: Uniform1i;
    ['u_depth_size_inv']: Uniform2f;
    ['u_depth_range_unpack']: Uniform2f;
    ['u_occluder_half_size']: Uniform1f;
    ['u_occlusion_depth_offset']: Uniform1f;
    ['u_meter_to_dem']?: Uniform1f;
    ['u_label_plane_matrix_inv']?: UniformMatrix4f;
};

export const terrainUniforms = (context: Context): TerrainUniformsType => ({
    'u_dem': new Uniform1i(context),
    'u_dem_prev': new Uniform1i(context),
    'u_dem_tl': new Uniform2f(context),
    'u_dem_scale': new Uniform1f(context),
    'u_dem_tl_prev': new Uniform2f(context),
    'u_dem_scale_prev': new Uniform1f(context),
    'u_dem_size': new Uniform1f(context),
    'u_dem_lerp': new Uniform1f(context),
    'u_exaggeration': new Uniform1f(context),
    'u_depth': new Uniform1i(context),
    'u_depth_size_inv': new Uniform2f(context),
    'u_depth_range_unpack': new Uniform2f(context),
    'u_occluder_half_size': new Uniform1f(context),
    'u_occlusion_depth_offset': new Uniform1f(context),
    'u_meter_to_dem': new Uniform1f(context),
    'u_label_plane_matrix_inv': new UniformMatrix4f(context),
});

export function defaultTerrainUniforms(): UniformValues<TerrainUniformsType> {
    return {
        'u_dem': 2,
        'u_dem_prev': 4,
        'u_dem_tl': [0, 0],
        'u_dem_tl_prev': [0, 0],
        'u_dem_scale': 0,
        'u_dem_scale_prev': 0,
        'u_dem_size': 0,
        'u_dem_lerp': 1.0,
        'u_depth': 3,
        'u_depth_size_inv': [0, 0],
        'u_depth_range_unpack': [0, 1],
        'u_occluder_half_size': 16,
        'u_occlusion_depth_offset': -0.0001,
        'u_exaggeration': 0,
    };
}

export type GlobeUniformsType = {
    ['u_tile_tl_up']: Uniform3f;
    ['u_tile_tr_up']: Uniform3f;
    ['u_tile_br_up']: Uniform3f;
    ['u_tile_bl_up']: Uniform3f;
    ['u_tile_up_scale']: Uniform1f;
};

export const globeUniforms = (context: Context): GlobeUniformsType => ({
    'u_tile_tl_up': new Uniform3f(context),
    'u_tile_tr_up': new Uniform3f(context),
    'u_tile_br_up': new Uniform3f(context),
    'u_tile_bl_up': new Uniform3f(context),
    'u_tile_up_scale': new Uniform1f(context)
});

export type ElevationDrawOptions = {
    useDepthForOcclusion?: boolean;
    useMeterToDem?: boolean;
    labelPlaneMatrixInv?: mat4 | null;
    morphing?: {
        srcDemTile: Tile;
        dstDemTile: Tile;
        phase: number;
    };
    useDenormalizedUpVectorScale?: boolean;
};
