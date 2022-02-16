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
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.js';
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
    'u_height_lift': Uniform1f
|};

export type FillExtrusionPatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_lightpos': Uniform3f,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3f,
    'u_height_factor': Uniform1f,
    'u_vertical_gradient': Uniform1f,
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
    'u_scale': Uniform3f,
    'u_fade': Uniform1f,
    'u_opacity': Uniform1f
|};

const fillExtrusionUniforms = (context: Context, locations: UniformLocations): FillExtrusionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    // globe uniforms:
    'u_tile_id': new Uniform3f(context, locations.u_tile_id),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_inv_rot_matrix': new UniformMatrix4f(context, locations.u_inv_rot_matrix),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_up_dir': new Uniform3f(context, locations.u_up_dir),
    'u_height_lift': new Uniform1f(context, locations.u_height_lift)
});

const fillExtrusionPatternUniforms = (context: Context, locations: UniformLocations): FillExtrusionPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_height_factor': new Uniform1f(context, locations.u_height_factor),
    // globe uniforms:
    'u_tile_id': new Uniform3f(context, locations.u_tile_id),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_inv_rot_matrix': new UniformMatrix4f(context, locations.u_inv_rot_matrix),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_up_dir': new Uniform3f(context, locations.u_up_dir),
    'u_height_lift': new Uniform1f(context, locations.u_height_lift),
    // pattern uniforms
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const identityMatrix = mat4.create();

const fillExtrusionUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    shouldUseVerticalGradient: boolean,
    opacity: number,
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
        'u_height_lift': 0
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
    coord: OverscaledTileID,
    crossfade: CrossfadeParameters,
    tile: Tile,
    heightLift: number,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array
): UniformValues<FillExtrusionPatternUniformsType> => {
    const uniformValues = fillExtrusionUniformValues(
        matrix, painter, shouldUseVerticalGradient, opacity, coord,
        heightLift, zoomTransition, mercatorCenter, invMatrix);
    const heightFactorUniform = {
        'u_height_factor': -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8
    };
    return extend(uniformValues, patternUniformValues(crossfade, painter, tile), heightFactorUniform);
};

export {
    fillExtrusionUniforms,
    fillExtrusionPatternUniforms,
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues
};
