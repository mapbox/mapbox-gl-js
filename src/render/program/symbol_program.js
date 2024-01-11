// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding.js';
import {mat4} from 'gl-matrix';
import {extend} from '../../util/util.js';
import browser from '../../util/browser.js';
import {OverscaledTileID} from '../../source/tile_id.js';
import type Context from '../../gl/context.js';
import type Painter from '../painter.js';
import type {UniformValues} from '../uniform_binding.js';
import {globeECEFOrigin} from '../../geo/projection/globe_util.js';
import type Projection from '../../geo/projection/projection.js';

import type {InterpolatedSize} from '../../symbol/symbol_size.js';

export type SymbolIconUniformsType = {|
    'u_is_size_zoom_constant': Uniform1i,
    'u_is_size_feature_constant': Uniform1i,
    'u_size_t': Uniform1f,
    'u_size': Uniform1f,
    'u_camera_to_center_distance': Uniform1f,
    'u_rotate_symbol': Uniform1i,
    'u_aspect_ratio': Uniform1f,
    'u_fade_change': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_label_plane_matrix': UniformMatrix4f,
    'u_coord_matrix': UniformMatrix4f,
    'u_is_text': Uniform1i,
    'u_pitch_with_map': Uniform1i,
    'u_texsize': Uniform2f,
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_camera_forward': Uniform3f,
    'u_tile_matrix': UniformMatrix4f,
    'u_up_vector': Uniform3f,
    'u_ecef_origin': Uniform3f,
    'u_texture': Uniform1i,
    'u_icon_transition': Uniform1f,
    'u_icon_saturation': Uniform1f
|};

export type SymbolSDFUniformsType = {|
    'u_is_size_zoom_constant': Uniform1i,
    'u_is_size_feature_constant': Uniform1i,
    'u_size_t': Uniform1f,
    'u_size': Uniform1f,
    'u_camera_to_center_distance': Uniform1f,
    'u_rotate_symbol': Uniform1i,
    'u_aspect_ratio': Uniform1f,
    'u_fade_change': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_label_plane_matrix': UniformMatrix4f,
    'u_coord_matrix': UniformMatrix4f,
    'u_is_text': Uniform1i,
    'u_pitch_with_map': Uniform1i,
    'u_texsize': Uniform2f,
    'u_texture': Uniform1i,
    'u_gamma_scale': Uniform1f,
    'u_device_pixel_ratio': Uniform1f,
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_camera_forward': Uniform3f,
    'u_tile_matrix': UniformMatrix4f,
    'u_up_vector': Uniform3f,
    'u_ecef_origin': Uniform3f,
    'u_is_halo': Uniform1i
|};

export type symbolTextAndIconUniformsType = {|
    'u_is_size_zoom_constant': Uniform1i,
    'u_is_size_feature_constant': Uniform1i,
    'u_size_t': Uniform1f,
    'u_size': Uniform1f,
    'u_camera_to_center_distance': Uniform1f,
    'u_rotate_symbol': Uniform1i,
    'u_aspect_ratio': Uniform1f,
    'u_fade_change': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_label_plane_matrix': UniformMatrix4f,
    'u_coord_matrix': UniformMatrix4f,
    'u_is_text': Uniform1i,
    'u_pitch_with_map': Uniform1i,
    'u_texsize': Uniform2f,
    'u_texsize_icon': Uniform2f,
    'u_texture': Uniform1i,
    'u_texture_icon': Uniform1i,
    'u_gamma_scale': Uniform1f,
    'u_device_pixel_ratio': Uniform1f,
    'u_is_halo': Uniform1i
|};

export type SymbolDefinesType = 'PITCH_WITH_MAP_TERRAIN';

const symbolIconUniforms = (context: Context): SymbolIconUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context),
    'u_is_size_feature_constant': new Uniform1i(context),
    'u_size_t': new Uniform1f(context),
    'u_size': new Uniform1f(context),
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_rotate_symbol': new Uniform1i(context),
    'u_aspect_ratio': new Uniform1f(context),
    'u_fade_change': new Uniform1f(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_label_plane_matrix': new UniformMatrix4f(context),
    'u_coord_matrix': new UniformMatrix4f(context),
    'u_is_text': new Uniform1i(context),
    'u_pitch_with_map': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_camera_forward': new Uniform3f(context),
    'u_tile_matrix': new UniformMatrix4f(context),
    'u_up_vector': new Uniform3f(context),
    'u_ecef_origin': new Uniform3f(context),
    'u_texture': new Uniform1i(context),
    'u_icon_transition': new Uniform1f(context),
    'u_icon_saturation': new Uniform1f(context)
});

const symbolSDFUniforms = (context: Context): SymbolSDFUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context),
    'u_is_size_feature_constant': new Uniform1i(context),
    'u_size_t': new Uniform1f(context),
    'u_size': new Uniform1f(context),
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_rotate_symbol': new Uniform1i(context),
    'u_aspect_ratio': new Uniform1f(context),
    'u_fade_change': new Uniform1f(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_label_plane_matrix': new UniformMatrix4f(context),
    'u_coord_matrix': new UniformMatrix4f(context),
    'u_is_text': new Uniform1i(context),
    'u_pitch_with_map': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_texture': new Uniform1i(context),
    'u_gamma_scale': new Uniform1f(context),
    'u_device_pixel_ratio': new Uniform1f(context),
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_camera_forward': new Uniform3f(context),
    'u_tile_matrix': new UniformMatrix4f(context),
    'u_up_vector': new Uniform3f(context),
    'u_ecef_origin': new Uniform3f(context),
    'u_is_halo': new Uniform1i(context)
});

const symbolTextAndIconUniforms = (context: Context): symbolTextAndIconUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context),
    'u_is_size_feature_constant': new Uniform1i(context),
    'u_size_t': new Uniform1f(context),
    'u_size': new Uniform1f(context),
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_rotate_symbol': new Uniform1i(context),
    'u_aspect_ratio': new Uniform1f(context),
    'u_fade_change': new Uniform1f(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_label_plane_matrix': new UniformMatrix4f(context),
    'u_coord_matrix': new UniformMatrix4f(context),
    'u_is_text': new Uniform1i(context),
    'u_pitch_with_map': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_texsize_icon': new Uniform2f(context),
    'u_texture': new Uniform1i(context),
    'u_texture_icon': new Uniform1i(context),
    'u_gamma_scale': new Uniform1f(context),
    'u_device_pixel_ratio': new Uniform1f(context),
    'u_is_halo': new Uniform1i(context)
});

const identityMatrix = mat4.create();

const symbolIconUniformValues = (
    functionType: string,
    size: ?InterpolatedSize,
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number],
    coord: OverscaledTileID,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array,
    upVector: [number, number, number],
    projection: Projection,
    iconSaturation: number,
    transition: ?number,
): UniformValues<SymbolIconUniformsType> => {
    const transform = painter.transform;

    const values = {
        'u_is_size_zoom_constant': +(functionType === 'constant' || functionType === 'source'),
        'u_is_size_feature_constant': +(functionType === 'constant' || functionType === 'camera'),
        'u_size_t': size ? size.uSizeT : 0,
        'u_size': size ? size.uSize : 0,
        'u_camera_to_center_distance': transform.getCameraToCenterDistance(projection),
        'u_rotate_symbol': +rotateInShader,
        'u_aspect_ratio': transform.width / transform.height,
        'u_fade_change': painter.options.fadeDuration ? painter.symbolFadeChange : 1,
        'u_matrix': matrix,
        'u_label_plane_matrix': labelPlaneMatrix,
        'u_coord_matrix': glCoordMatrix,
        'u_is_text': +isText,
        'u_pitch_with_map': +pitchWithMap,
        'u_texsize': texSize,
        'u_texture': 0,
        'u_tile_id': [0, 0, 0],
        'u_zoom_transition': 0,
        'u_inv_rot_matrix': identityMatrix,
        'u_merc_center': [0, 0],
        'u_camera_forward': [0, 0, 0],
        'u_ecef_origin': [0, 0, 0],
        'u_tile_matrix': identityMatrix,
        'u_up_vector': [0, -1, 0],
        'u_icon_transition': transition ? transition : 0.0,
        'u_icon_saturation': iconSaturation
    };

    if (projection.name === 'globe') {
        values['u_tile_id'] = [coord.canonical.x, coord.canonical.y, 1 << coord.canonical.z];
        values['u_zoom_transition'] = zoomTransition;
        values['u_inv_rot_matrix'] = invMatrix;
        values['u_merc_center'] = mercatorCenter;
        values['u_camera_forward'] = ((transform._camera.forward(): any): [number, number, number]);
        values['u_ecef_origin'] = globeECEFOrigin(transform.globeMatrix, coord.toUnwrapped());
        values['u_tile_matrix'] = Float32Array.from(transform.globeMatrix);
        values['u_up_vector'] = upVector;
    }

    return values;
};

const symbolSDFUniformValues = (
    functionType: string,
    size: ?InterpolatedSize,
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number],
    isHalo: boolean,
    coord: OverscaledTileID,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array,
    upVector: [number, number, number],
    projection: Projection
): UniformValues<SymbolSDFUniformsType> => {
    return extend(symbolIconUniformValues(functionType, size, rotateInShader,
        pitchWithMap, painter, matrix, labelPlaneMatrix, glCoordMatrix, isText,
        texSize, coord, zoomTransition, mercatorCenter, invMatrix, upVector, projection, 1), {
        'u_gamma_scale': pitchWithMap ? painter.transform.getCameraToCenterDistance(projection) * Math.cos(painter.terrain ? 0 : painter.transform._pitch) : 1,
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_is_halo': +isHalo,
        undefined
    });
};

const symbolTextAndIconUniformValues = (
    functionType: string,
    size: ?InterpolatedSize,
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    texSizeSDF: [number, number],
    texSizeIcon: [number, number],
    coord: OverscaledTileID,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: Float32Array,
    upVector: [number, number, number],
    projection: Projection
): UniformValues<SymbolIconUniformsType> => {
    return extend(symbolSDFUniformValues(functionType, size, rotateInShader,
        pitchWithMap, painter, matrix, labelPlaneMatrix, glCoordMatrix, true, texSizeSDF,
        true, coord, zoomTransition, mercatorCenter, invMatrix, upVector, projection), {
        'u_texsize_icon': texSizeIcon,
        'u_texture_icon': 1
    });
};

export {symbolIconUniforms, symbolSDFUniforms, symbolIconUniformValues, symbolSDFUniformValues, symbolTextAndIconUniformValues, symbolTextAndIconUniforms};
