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
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
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
    'u_texture': Uniform1i
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

const symbolIconUniforms = (context: Context, locations: UniformLocations): SymbolIconUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context, locations.u_is_size_zoom_constant),
    'u_is_size_feature_constant': new Uniform1i(context, locations.u_is_size_feature_constant),
    'u_size_t': new Uniform1f(context, locations.u_size_t),
    'u_size': new Uniform1f(context, locations.u_size),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_rotate_symbol': new Uniform1i(context, locations.u_rotate_symbol),
    'u_aspect_ratio': new Uniform1f(context, locations.u_aspect_ratio),
    'u_fade_change': new Uniform1f(context, locations.u_fade_change),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_label_plane_matrix': new UniformMatrix4f(context, locations.u_label_plane_matrix),
    'u_coord_matrix': new UniformMatrix4f(context, locations.u_coord_matrix),
    'u_is_text': new Uniform1i(context, locations.u_is_text),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_tile_id': new Uniform3f(context, locations.u_tile_id),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_inv_rot_matrix': new UniformMatrix4f(context, locations.u_inv_rot_matrix),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_camera_forward': new Uniform3f(context, locations.u_camera_forward),
    'u_tile_matrix': new UniformMatrix4f(context, locations.u_tile_matrix),
    'u_up_vector': new Uniform3f(context, locations.u_up_vector),
    'u_ecef_origin': new Uniform3f(context, locations.u_ecef_origin),
    'u_texture': new Uniform1i(context, locations.u_texture)
});

const symbolSDFUniforms = (context: Context, locations: UniformLocations): SymbolSDFUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context, locations.u_is_size_zoom_constant),
    'u_is_size_feature_constant': new Uniform1i(context, locations.u_is_size_feature_constant),
    'u_size_t': new Uniform1f(context, locations.u_size_t),
    'u_size': new Uniform1f(context, locations.u_size),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_rotate_symbol': new Uniform1i(context, locations.u_rotate_symbol),
    'u_aspect_ratio': new Uniform1f(context, locations.u_aspect_ratio),
    'u_fade_change': new Uniform1f(context, locations.u_fade_change),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_label_plane_matrix': new UniformMatrix4f(context, locations.u_label_plane_matrix),
    'u_coord_matrix': new UniformMatrix4f(context, locations.u_coord_matrix),
    'u_is_text': new Uniform1i(context, locations.u_is_text),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_gamma_scale': new Uniform1f(context, locations.u_gamma_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_tile_id': new Uniform3f(context, locations.u_tile_id),
    'u_zoom_transition': new Uniform1f(context, locations.u_zoom_transition),
    'u_inv_rot_matrix': new UniformMatrix4f(context, locations.u_inv_rot_matrix),
    'u_merc_center': new Uniform2f(context, locations.u_merc_center),
    'u_camera_forward': new Uniform3f(context, locations.u_camera_forward),
    'u_tile_matrix': new UniformMatrix4f(context, locations.u_tile_matrix),
    'u_up_vector': new Uniform3f(context, locations.u_up_vector),
    'u_ecef_origin': new Uniform3f(context, locations.u_ecef_origin),
    'u_is_halo': new Uniform1i(context, locations.u_is_halo)
});

const symbolTextAndIconUniforms = (context: Context, locations: UniformLocations): symbolTextAndIconUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context, locations.u_is_size_zoom_constant),
    'u_is_size_feature_constant': new Uniform1i(context, locations.u_is_size_feature_constant),
    'u_size_t': new Uniform1f(context, locations.u_size_t),
    'u_size': new Uniform1f(context, locations.u_size),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_rotate_symbol': new Uniform1i(context, locations.u_rotate_symbol),
    'u_aspect_ratio': new Uniform1f(context, locations.u_aspect_ratio),
    'u_fade_change': new Uniform1f(context, locations.u_fade_change),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_label_plane_matrix': new UniformMatrix4f(context, locations.u_label_plane_matrix),
    'u_coord_matrix': new UniformMatrix4f(context, locations.u_coord_matrix),
    'u_is_text': new Uniform1i(context, locations.u_is_text),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_texsize_icon': new Uniform2f(context, locations.u_texsize_icon),
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_texture_icon': new Uniform1i(context, locations.u_texture_icon),
    'u_gamma_scale': new Uniform1f(context, locations.u_gamma_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_is_halo': new Uniform1i(context, locations.u_is_halo)
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
    projection: Projection
): UniformValues<SymbolIconUniformsType> => {
    const transform = painter.transform;

    const values = {
        'u_is_size_zoom_constant': +(functionType === 'constant' || functionType === 'source'),
        'u_is_size_feature_constant': +(functionType === 'constant' || functionType === 'camera'),
        'u_size_t': size ? size.uSizeT : 0,
        'u_size': size ? size.uSize : 0,
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
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
        'u_up_vector': [0, -1, 0]
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
        texSize, coord, zoomTransition, mercatorCenter, invMatrix, upVector, projection), {
        'u_gamma_scale': pitchWithMap ? painter.transform.cameraToCenterDistance * Math.cos(painter.terrain ? 0 : painter.transform._pitch) : 1,
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_is_halo': +isHalo
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
