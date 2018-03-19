// @flow

import { patternUniformValues } from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    Uniform3fv,
    UniformMatrix4fv
} from '../uniform_binding';

import glMatrix from '@mapbox/gl-matrix';
const mat3 = glMatrix.mat3;
const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
import { extend } from '../../util/util';

import type Context from '../../gl/context';
import type Painter from '../painter';
import type {OverscaledTileID} from '../../source/tile_id';
import type {CrossFaded} from '../../style/cross_faded';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer';

export type FillExtrusionUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_lightpos': Uniform3fv,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3fv
|};

export type FillExtrusionPatternUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_lightpos': Uniform3fv,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3fv,
    'u_height_factor': Uniform1f,
    // pattern uniforms:
    'u_image': Uniform1i,
    'u_pattern_tl_a': Uniform2fv,
    'u_pattern_br_a': Uniform2fv,
    'u_pattern_tl_b': Uniform2fv,
    'u_pattern_br_b': Uniform2fv,
    'u_texsize': Uniform2fv,
    'u_mix': Uniform1f,
    'u_pattern_size_a': Uniform2fv,
    'u_pattern_size_b': Uniform2fv,
    'u_scale_a': Uniform1f,
    'u_scale_b': Uniform1f,
    'u_pixel_coord_upper': Uniform2fv,
    'u_pixel_coord_lower': Uniform2fv,
    'u_tile_units_to_pixels': Uniform1f
|};

export type ExtrusionTextureUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_world': Uniform2fv,
    'u_image': Uniform1i,
    'u_opacity': Uniform1f
|};

const fillExtrusionUniforms = (context: Context, locations: UniformLocations): FillExtrusionUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_lightpos': new Uniform3fv(context, locations.u_lightpos),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3fv(context, locations.u_lightcolor)
});

const fillExtrusionPatternUniforms = (context: Context, locations: UniformLocations): FillExtrusionPatternUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_lightpos': new Uniform3fv(context, locations.u_lightpos),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3fv(context, locations.u_lightcolor),
    'u_height_factor': new Uniform1f(context, locations.u_height_factor),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_pattern_tl_a': new Uniform2fv(context, locations.u_pattern_tl_a),
    'u_pattern_br_a': new Uniform2fv(context, locations.u_pattern_br_a),
    'u_pattern_tl_b': new Uniform2fv(context, locations.u_pattern_tl_b),
    'u_pattern_br_b': new Uniform2fv(context, locations.u_pattern_br_b),
    'u_texsize': new Uniform2fv(context, locations.u_texsize),
    'u_mix': new Uniform1f(context, locations.u_mix),
    'u_pattern_size_a': new Uniform2fv(context, locations.u_pattern_size_a),
    'u_pattern_size_b': new Uniform2fv(context, locations.u_pattern_size_b),
    'u_scale_a': new Uniform1f(context, locations.u_scale_a),
    'u_scale_b': new Uniform1f(context, locations.u_scale_b),
    'u_pixel_coord_upper': new Uniform2fv(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2fv(context, locations.u_pixel_coord_lower),
    'u_tile_units_to_pixels': new Uniform1f(context, locations.u_tile_units_to_pixels)
});

const extrusionTextureUniforms = (context: Context, locations: UniformLocations): ExtrusionTextureUniformsType => ({
    'u_matrix': new UniformMatrix4fv(context, locations.u_matrix),
    'u_world': new Uniform2fv(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const fillExtrusionUniformValues = (
    matrix: Float32Array,
    painter: Painter
): UniformValues<FillExtrusionUniformsType> => {
    const light = painter.style.light;
    const _lp = light.properties.get('position');
    const lightPos = [_lp.x, _lp.y, _lp.z];
    const lightMat = mat3.create();
    if (light.properties.get('anchor') === 'viewport') {
        mat3.fromRotation(lightMat, -painter.transform.angle);
    }
    vec3.transformMat3(lightPos, lightPos, lightMat);

    const lightColor = light.properties.get('color');

    return {
        'u_matrix': matrix,
        'u_lightpos': lightPos,
        'u_lightintensity': light.properties.get('intensity'),
        'u_lightcolor': [lightColor.r, lightColor.g, lightColor.b]
    };
};

const fillExtrusionPatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    coord: OverscaledTileID,
    image: CrossFaded<string>,
    tile: {tileID: OverscaledTileID, tileSize: number}
): UniformValues<FillExtrusionPatternUniformsType> => {
    return extend(fillExtrusionUniformValues(matrix, painter),
        patternUniformValues(image, painter, tile),
        {
            'u_height_factor': -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8
        });
};

const extrusionTextureUniformValues = (
    painter: Painter,
    layer: FillExtrusionStyleLayer,
    textureUnit: number
): UniformValues<ExtrusionTextureUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': textureUnit,
        'u_opacity': layer.paint.get('fill-extrusion-opacity')
    };
};

export {
    fillExtrusionUniforms,
    fillExtrusionPatternUniforms,
    extrusionTextureUniforms,
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    extrusionTextureUniformValues
};
