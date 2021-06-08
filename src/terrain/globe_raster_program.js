// @flow

import {
    Uniform1i,
    Uniform1f,
    UniformMatrix4f
} from '../render/uniform_binding.js';

import type Context from '../gl/context.js';
import type {UniformValues, UniformLocations} from '../render/uniform_binding.js';

export type GlobeRasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image0': Uniform1i//,
    //'u_skirt_height': Uniform1f
|};

const globeRasterUniforms = (context: Context, locations: UniformLocations): GlobeRasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image0': new Uniform1i(context, locations.u_image0)//,
    //'u_skirt_height': new Uniform1f(context, locations.u_skirt_height)
});

const globeRasterUniformValues = (
    matrix: Float32Array//,
    //skirtHeight: number
): UniformValues<GlobeRasterUniformsType> => ({
    'u_matrix': matrix,
    'u_image0': 0//,
    //'u_skirt_height': skirtHeight
});

export {globeRasterUniforms, globeRasterUniformValues};
