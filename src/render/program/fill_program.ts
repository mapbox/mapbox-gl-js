import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding';
import {extend} from '../../util/util';

import type {mat4} from 'gl-matrix';
import type Painter from '../painter';
import type {UniformValues} from '../uniform_binding';
import type Context from '../../gl/context';
import type Tile from '../../source/tile';

export type FillUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
};

export type FillOutlineUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_world']: Uniform2f;
};

export type FillPatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    // pattern uniforms:
    ['u_texsize']: Uniform2f;
    ['u_image']: Uniform1i;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
};

export type FillOutlinePatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_world']: Uniform2f;
    // pattern uniforms:
    ['u_texsize']: Uniform2f;
    ['u_image']: Uniform1i;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
};

export type ElevatedStructuresUniformsType = {
    ['u_matrix']: UniformMatrix4f;
};

export type FillDefinesType = 'ELEVATED_ROADS';

const fillUniforms = (context: Context): FillUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context)
});

const fillPatternUniforms = (context: Context): FillPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context)
});

const fillOutlineUniforms = (context: Context): FillOutlineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_world': new Uniform2f(context)
});

const fillOutlinePatternUniforms = (context: Context): FillOutlinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_world': new Uniform2f(context),
    'u_image': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context)
});

const elevatedStructuresUniforms = (context: Context): ElevatedStructuresUniformsType => ({
    'u_matrix': new UniformMatrix4f(context)
});

const fillUniformValues = (matrix: mat4, emissiveStrength: number): UniformValues<FillUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_emissive_strength': emissiveStrength
});

const fillPatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
): UniformValues<FillPatternUniformsType> => extend(
    fillUniformValues(matrix, emissiveStrength),
    patternUniformValues(painter, tile)
);

const fillOutlineUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    drawingBufferSize: [number, number],
): UniformValues<FillOutlineUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_world': drawingBufferSize,
    'u_emissive_strength': emissiveStrength
});

const fillOutlinePatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    painter: Painter,
    tile: Tile,
    drawingBufferSize: [number, number],
): UniformValues<FillOutlinePatternUniformsType> => extend(
    fillPatternUniformValues(matrix, emissiveStrength, painter, tile),
    {
        'u_world': drawingBufferSize
    }
);

const elevatedStructuresUniformValues = (matrix: mat4): UniformValues<ElevatedStructuresUniformsType> => ({
    'u_matrix': matrix as Float32Array
});

export {
    fillUniforms,
    fillPatternUniforms,
    fillOutlineUniforms,
    fillOutlinePatternUniforms,
    elevatedStructuresUniforms,
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues,
    elevatedStructuresUniformValues
};
