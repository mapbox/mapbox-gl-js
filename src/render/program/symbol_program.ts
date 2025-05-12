import {Uniform1i, Uniform1f, Uniform2f, Uniform3f, UniformMatrix4f} from '../uniform_binding';
import {mat4} from 'gl-matrix';
import browser from '../../util/browser';
import {globeECEFOrigin} from '../../geo/projection/globe_util';

import type {OverscaledTileID} from '../../source/tile_id';
import type Context from '../../gl/context';
import type Painter from '../painter';
import type {UniformValues} from '../uniform_binding';
import type Projection from '../../geo/projection/projection';
import type {InterpolatedSize} from '../../symbol/symbol_size';

export type SymbolUniformsType = {
    ['u_is_size_zoom_constant']: Uniform1i;
    ['u_is_size_feature_constant']: Uniform1i;
    ['u_size_t']: Uniform1f;
    ['u_size']: Uniform1f;
    ['u_camera_to_center_distance']: Uniform1f;
    ['u_rotate_symbol']: Uniform1i;
    ['u_aspect_ratio']: Uniform1f;
    ['u_fade_change']: Uniform1f;
    ['u_matrix']: UniformMatrix4f;
    ['u_label_plane_matrix']: UniformMatrix4f;
    ['u_coord_matrix']: UniformMatrix4f;
    ['u_is_text']: Uniform1i;
    ['u_elevation_from_sea']: Uniform1i;
    ['u_pitch_with_map']: Uniform1i;
    ['u_texsize']: Uniform2f;
    ['u_texsize_icon']: Uniform2f;
    ['u_texture']: Uniform1i;
    ['u_texture_icon']: Uniform1i;
    ['u_gamma_scale']: Uniform1f;
    ['u_device_pixel_ratio']: Uniform1f;
    ['u_tile_id']: Uniform3f;
    ['u_zoom_transition']: Uniform1f;
    ['u_inv_rot_matrix']: UniformMatrix4f;
    ['u_merc_center']: Uniform2f;
    ['u_camera_forward']: Uniform3f;
    ['u_tile_matrix']: UniformMatrix4f;
    ['u_up_vector']: Uniform3f;
    ['u_ecef_origin']: Uniform3f;
    ['u_is_halo']: Uniform1i;
    ['u_icon_transition']: Uniform1f;
    ['u_color_adj_mat']: UniformMatrix4f;
    ['u_scale_factor']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_inv_matrix']: UniformMatrix4f;
    ['u_normal_scale']: Uniform1f;
};

export type SymbolDefinesType =
    | 'COLOR_ADJUSTMENT'
    | 'ICON_TRANSITION'
    | 'PITCH_WITH_MAP_TERRAIN'
    | 'PROJECTED_POS_ON_VIEWPORT'
    | 'RENDER_SDF'
    | 'RENDER_TEXT_AND_SYMBOL'
    | 'Z_OFFSET';

const symbolUniforms = (context: Context): SymbolUniformsType => ({
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
    'u_elevation_from_sea': new Uniform1i(context),
    'u_pitch_with_map': new Uniform1i(context),
    'u_texsize': new Uniform2f(context),
    'u_texsize_icon': new Uniform2f(context),
    'u_texture': new Uniform1i(context),
    'u_texture_icon': new Uniform1i(context),
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
    'u_is_halo': new Uniform1i(context),
    'u_icon_transition': new Uniform1f(context),
    'u_color_adj_mat': new UniformMatrix4f(context),
    'u_scale_factor': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_inv_matrix': new UniformMatrix4f(context),
    'u_normal_scale': new Uniform1f(context)
});

const identityMatrix = mat4.create();

const symbolUniformValues = (
    functionType: string,
    size: InterpolatedSize | null | undefined,
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: mat4,
    labelPlaneMatrix: mat4,
    glCoordMatrix: mat4,
    elevationFromSea: boolean,
    isText: boolean,
    texSize: [number, number],
    texSizeIcon: [number, number],
    isHalo: boolean,
    coord: OverscaledTileID,
    zoomTransition: number,
    mercatorCenter: [number, number],
    invMatrix: mat4,
    upVector: [number, number, number],
    projection: Projection,
    groundShadowFactor: [number, number, number],
    normalScale: number,
    colorAdjustmentMatrix?: mat4 | null,
    transition?: number | null,
    scaleFactor?: number | null
): UniformValues<SymbolUniformsType> => {
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
        'u_matrix': matrix as Float32Array,
        'u_label_plane_matrix': labelPlaneMatrix as Float32Array,
        'u_coord_matrix': glCoordMatrix as Float32Array,
        'u_is_text': +isText,
        'u_elevation_from_sea': elevationFromSea ? 1.0 : 0.0,
        'u_pitch_with_map': +pitchWithMap,
        'u_texsize': texSize,
        'u_texsize_icon': texSizeIcon,
        'u_texture': 0,
        'u_texture_icon': 1,
        'u_tile_id': [0, 0, 0] as [number, number, number],
        'u_zoom_transition': 0,
        'u_inv_rot_matrix': identityMatrix as Float32Array,
        'u_merc_center': [0, 0] as [number, number],
        'u_camera_forward': [0, 0, 0] as [number, number, number],
        'u_ecef_origin': [0, 0, 0] as [number, number, number],
        'u_tile_matrix': identityMatrix as Float32Array,
        'u_up_vector': [0, -1, 0] as [number, number, number],
        'u_color_adj_mat': colorAdjustmentMatrix as Float32Array,
        'u_icon_transition': transition ? transition : 0.0,
        'u_gamma_scale': pitchWithMap ? painter.transform.getCameraToCenterDistance(projection) * Math.cos(painter.terrain ? 0 : painter.transform._pitch) : 1,
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_is_halo': +isHalo,
        'u_scale_factor': scaleFactor ? scaleFactor : 1.0,
        'u_ground_shadow_factor': groundShadowFactor,
        'u_inv_matrix': mat4.invert(mat4.create(), labelPlaneMatrix) as Float32Array,
        'u_normal_scale': normalScale
    };

    if (projection.name === 'globe') {
        values['u_tile_id'] = [coord.canonical.x, coord.canonical.y, 1 << coord.canonical.z];
        values['u_zoom_transition'] = zoomTransition;
        values['u_inv_rot_matrix'] = invMatrix as Float32Array;
        values['u_merc_center'] = mercatorCenter;
        values['u_camera_forward'] = (transform._camera.forward() as [number, number, number]);
        values['u_ecef_origin'] = globeECEFOrigin(transform.globeMatrix, coord.toUnwrapped());
        values['u_tile_matrix'] = Float32Array.from(transform.globeMatrix);
        values['u_up_vector'] = upVector;
    }

    return values;
};

export {symbolUniforms, symbolUniformValues};
