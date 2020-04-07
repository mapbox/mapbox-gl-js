// @flow

import {
    Uniform1i,
    Uniform1f,
    UniformMatrix4f
} from '../render/uniform_binding';
import EXTENT from '../data/extent';
import {GRID_DIM} from './terrain';

import type Context from '../gl/context';
import type {UniformValues, UniformLocations} from '../render/uniform_binding';

export type TerrainRasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image0': Uniform1i,
    'u_skirt_height': Uniform1f
|};

const terrainRasterUniforms = (context: Context, locations: UniformLocations): TerrainRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_skirt_height': new Uniform1f(context, locations.u_skirt_height)
});

const terrainRasterUniformValues = (
    matrix: Float32Array,
    zoom: number
): UniformValues<TerrainRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_image0': 0,
    // Skirt height calculation is heuristic: provided value hides
    // seams between tiles and it is not too large.
    'u_skirt_height': Math.pow(2, 16 - zoom) * EXTENT / GRID_DIM
});

export {terrainRasterUniforms, terrainRasterUniformValues};
