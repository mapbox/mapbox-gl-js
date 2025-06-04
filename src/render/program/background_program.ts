import {bgPatternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformMatrix4f
} from '../uniform_binding';
import {extend} from '../../util/util';

import type {mat4} from 'gl-matrix';
import type Painter from '../painter';
import type {UniformValues} from '../uniform_binding';
import type Context from '../../gl/context';
import type {OverscaledTileID} from '../../source/tile_id';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image';
import type {NonPremultipliedRenderColor} from "../../style-spec/util/color";
import type {ImagePosition} from "../image_atlas";

export type BackgroundUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_opacity']: Uniform1f;
    ['u_color']: UniformColor;
};

export type BackgroundPatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_opacity']: Uniform1f;
    // pattern uniforms:
    ['u_image']: Uniform1i;
    ['u_pattern_tl']: Uniform2f;
    ['u_pattern_br']: Uniform2f;
    ['u_texsize']: Uniform2f;
    ['u_pattern_size']: Uniform2f;
    ['u_pixel_coord_upper']: Uniform2f;
    ['u_pixel_coord_lower']: Uniform2f;
    ['u_pattern_units_to_pixels']: Uniform2f;
};

const backgroundUniforms = (context: Context): BackgroundUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_color': new UniformColor(context)
});

const backgroundPatternUniforms = (context: Context): BackgroundPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_pattern_tl': new Uniform2f(context),
    'u_pattern_br': new Uniform2f(context),
    'u_texsize': new Uniform2f(context),
    'u_pattern_size': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_pattern_units_to_pixels': new Uniform2f(context)
});

const backgroundUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    opacity: number,
    color: NonPremultipliedRenderColor,
): UniformValues<BackgroundUniformsType> => ({
    'u_matrix': matrix as Float32Array,
    'u_emissive_strength': emissiveStrength,
    'u_opacity': opacity,
    'u_color': color
});

const backgroundPatternUniformValues = (
    matrix: mat4,
    emissiveStrength: number,
    opacity: number,
    painter: Painter,
    image: ResolvedImage,
    scope: string,
    patternPosition: ImagePosition | null | undefined,
    isViewport: boolean,
    tile: {
        tileID: OverscaledTileID;
        tileSize: number;
    },
): UniformValues<BackgroundPatternUniformsType> => extend(
    bgPatternUniformValues(image, scope, patternPosition, painter, isViewport, tile),
    {
        'u_matrix': matrix as Float32Array,
        'u_emissive_strength': emissiveStrength,
        'u_opacity': opacity
    }
);

export {
    backgroundUniforms,
    backgroundPatternUniforms,
    backgroundUniformValues,
    backgroundPatternUniformValues
};
