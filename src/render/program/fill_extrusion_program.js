// @flow

import {patternUniformValues} from './pattern.js';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding.js';
import {mat3, mat4, vec3} from 'gl-matrix';
import {extend} from '../../util/util.js';
import type Context from '../../gl/context.js';
import type Painter from '../painter.js';
import type {UniformValues} from '../uniform_binding.js';
import type Tile from '../../source/tile.js';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id.js';
import EXTENT from '../../data/extent.js';

export type FillExtrusionUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_lightpos': Uniform3f,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3f,
    'u_vertical_gradient': Uniform1f,
    'u_opacity': Uniform1f,
    // globe uniforms:
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_up_dir': Uniform3f,
    'u_height_lift': Uniform1f,
    'u_ao': Uniform2f,
    'u_edge_radius': Uniform1f
|};

export type FillExtrusionPatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_lightpos': Uniform3f,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3f,
    'u_height_factor': Uniform1f,
    'u_vertical_gradient': Uniform1f,
    'u_ao': Uniform2f,
    'u_edge_radius': Uniform1f,
    // globe uniforms:
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_up_dir': Uniform3f,
    'u_height_lift': Uniform1f,
    // pattern uniforms:
    'u_texsize': Uniform2f,
    'u_image': Uniform1i,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f,
    'u_tile_units_to_pixels': Uniform1f,
    'u_opacity': Uniform1f
|};

const fillExtrusionUniforms = (context: Context): FillExtrusionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_lightpos': new Uniform3f(context),
    'u_lightintensity': new Uniform1f(context),
    'u_lightcolor': new Uniform3f(context),
    'u_vertical_gradient': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_edge_radius': new Uniform1f(context),
    'u_ao': new Uniform2f(context),
    // globe uniforms:
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_up_dir': new Uniform3f(context),
    'u_height_lift': new Uniform1f(context)
});

const fillExtrusionPatternUniforms = (context: Context): FillExtrusionPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_lightpos': new Uniform3f(context),
    'u_lightintensity': new Uniform1f(context),
    'u_lightcolor': new Uniform3f(context),
    'u_vertical_gradient': new Uniform1f(context),
    'u_height_factor': new Uniform1f(context),
    'u_edge_radius': new Uniform1f(context),
    'u_ao': new Uniform2f(context),
    // globe uniforms:
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_up_dir': new Uniform3f(context),
    'u_height_lift': new Uniform1f(context),
    // pattern uniforms
    'u_image': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_pixel_coord_upper': new Uniform2f(context),
    'u_pixel_coord_lower': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context),
    'u_opacity': new Uniform1f(context)
});

const identityMatrix = mat4.create();

const fillExtrusionUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    shouldUseVerticalGradient: boolean,
    opacity: number,
    aoIntensityRadius: [number, number],
    edgeRadius: number,
    coord: OverscaledTileID,
    heightLift: number,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array
): UniformValues<FillExtrusionUniformsType> => {
    const light = painter.style.light;
    const _lp = light.properties.get('position');
    const lightPos = [_lp.x, _lp.y, _lp.z];
    const lightMat = mat3.create();
    const anchor = light.properties.get('anchor');
    if (anchor === 'viewport') {
        mat3.fromRotation(lightMat, -painter.transform.angle);
        vec3.transformMat3(lightPos, lightPos, lightMat);
    }

    const lightColor = light.properties.get('color');
    const tr = painter.transform;

    const uniformValues = {
        'u_matrix': matrix,
        'u_lightpos': lightPos,
        'u_lightintensity': light.properties.get('intensity'),
        'u_lightcolor': [lightColor.r, lightColor.g, lightColor.b],
        'u_vertical_gradient': +shouldUseVerticalGradient,
        'u_opacity': opacity,
        'u_tile_id': [0, 0, 0],
        'u_zoom_transition': 0,
        'u_inv_rot_matrix': identityMatrix,
        'u_merc_center': [0, 0],
        'u_up_dir': [0, 0, 0],
        'u_height_lift': 0,
        'u_ao': aoIntensityRadius,
        'u_edge_radius': edgeRadius
    };

    if (tr.projection.name === 'globe') {
        uniformValues['u_tile_id'] = [coord.canonical.x, coord.canonical.y, 1 << coord.canonical.z];
        uniformValues['u_zoom_transition'] = zoomTransition;
        uniformValues['u_inv_rot_matrix'] = invMatrix;
        uniformValues['u_merc_center'] = mercatorCenter;
        uniformValues['u_up_dir'] = (tr.projection.upVector(new CanonicalTileID(0, 0, 0), mercatorCenter[0] * EXTENT, mercatorCenter[1] * EXTENT): any);
        uniformValues['u_height_lift'] = heightLift;
    }

    return uniformValues;
};

const fillExtrusionPatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    shouldUseVerticalGradient: boolean,
    opacity: number,
    aoIntensityRadius: [number, number],
    edgeRadius: number,
    coord: OverscaledTileID,
    tile: Tile,
    heightLift: number,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array
): UniformValues<FillExtrusionPatternUniformsType> => {
    const uniformValues = fillExtrusionUniformValues(
        matrix, painter, shouldUseVerticalGradient, opacity, aoIntensityRadius, edgeRadius, coord,
        heightLift, zoomTransition, mercatorCenter, invMatrix);
    const heightFactorUniform = {
        'u_height_factor': -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8
    };
    return extend(uniformValues, patternUniformValues(painter, tile), heightFactorUniform);
};

export {
    fillExtrusionUniforms,
    fillExtrusionPatternUniforms,
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues
};
