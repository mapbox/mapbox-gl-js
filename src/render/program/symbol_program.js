// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Context from '../../gl/context';
import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';

type u_is_size_zoom_constant = Uniform1i;
type u_is_size_feature_constant = Uniform1i;
type u_size_t = Uniform1f;
type u_size = Uniform1f;
type u_camera_to_center_distance = Uniform1f;
type u_pitch = Uniform1f;
type u_rotate_symbol = Uniform1i;
type u_aspect_ratio = Uniform1f;
type u_fade_change = Uniform1f;
type u_matrix = UniformMatrix4fv;
type u_label_plane_matrix = UniformMatrix4fv;
type u_gl_coord_matrix = UniformMatrix4fv;
type u_is_text = Uniform1f;
type u_pitch_with_map = Uniform1i;
type u_texsize = Uniform2fv;
type u_texture = Uniform1i;
type u_gamma_scale = Uniform1f;
type u_is_halo = Uniform1f;

export type SymbolIconUniformsType = [
    u_is_size_zoom_constant,
    u_is_size_feature_constant,
    u_size_t,
    u_size,
    u_camera_to_center_distance,
    u_pitch,
    u_rotate_symbol,
    u_aspect_ratio,
    u_fade_change,
    u_matrix,
    u_label_plane_matrix,
    u_gl_coord_matrix,
    u_is_text,
    u_pitch_with_map,
    u_texsize,
    u_texture
];

const symbolIconUniforms = (context: Context, locations: UniformLocations): SymbolIconUniformsType => ([
    new Uniform1i(context, locations['u_is_size_zoom_constant']),
    new Uniform1i(context, locations['u_is_size_feature_constant']),
    new Uniform1f(context, locations['u_size_t']),
    new Uniform1f(context, locations['u_size']),
    new Uniform1f(context, locations['u_camera_to_center_distance']),
    new Uniform1f(context, locations['u_pitch']),
    new Uniform1i(context, locations['u_rotate_symbol']),
    new Uniform1f(context, locations['u_aspect_ratio']),
    new Uniform1f(context, locations['u_fade_change']),
    new UniformMatrix4fv(context, locations['u_matrix']),
    new UniformMatrix4fv(context, locations['u_label_plane_matrix']),
    new UniformMatrix4fv(context, locations['u_gl_coord_matrix']),
    new Uniform1f(context, locations['u_is_text']),
    new Uniform1i(context, locations['u_pitch_with_map']),
    new Uniform2fv(context, locations['u_texsize']),
    new Uniform1i(context, locations['u_texture'])
]);

const symbolIconUniformValues = (
    functionType: string,
    size: ?{uSizeT: number, uSize: number},
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number]
): UniformValues<SymbolIconUniformsType> => {
    const transform = painter.transform;

    return [
        +(functionType === 'constant' || functionType === 'source'),
        +(functionType === 'constant' || functionType === 'camera'),
        size ? size.uSizeT : 0,
        size ? size.uSize : 0,
        transform.cameraToCenterDistance,
        transform.pitch / 360 * 2 * Math.PI,
        +rotateInShader,
        transform.width / transform.height,
        painter.options.fadeDuration ? painter.symbolFadeChange : 1,
        matrix,
        labelPlaneMatrix,
        glCoordMatrix,
        +isText,
        +pitchWithMap,
        texSize,
        0
    ];
};

export type SymbolSDFUniformsType = [
    u_is_size_zoom_constant,
    u_is_size_feature_constant,
    u_size_t,
    u_size,
    u_camera_to_center_distance,
    u_pitch,
    u_rotate_symbol,
    u_aspect_ratio,
    u_fade_change,
    u_matrix,
    u_label_plane_matrix,
    u_gl_coord_matrix,
    u_is_text,
    u_pitch_with_map,
    u_texsize,
    u_texture,
    u_gamma_scale,
    u_is_halo
];

const symbolSDFUniforms = (context: Context, locations: UniformLocations): SymbolSDFUniformsType => ([
    new Uniform1i(context, locations['u_is_size_zoom_constant']),
    new Uniform1i(context, locations['u_is_size_feature_constant']),
    new Uniform1f(context, locations['u_size_t']),
    new Uniform1f(context, locations['u_size']),
    new Uniform1f(context, locations['u_camera_to_center_distance']),
    new Uniform1f(context, locations['u_pitch']),
    new Uniform1i(context, locations['u_rotate_symbol']),
    new Uniform1f(context, locations['u_aspect_ratio']),
    new Uniform1f(context, locations['u_fade_change']),
    new UniformMatrix4fv(context, locations['u_matrix']),
    new UniformMatrix4fv(context, locations['u_label_plane_matrix']),
    new UniformMatrix4fv(context, locations['u_gl_coord_matrix']),
    new Uniform1f(context, locations['u_is_text']),
    new Uniform1i(context, locations['u_pitch_with_map']),
    new Uniform2fv(context, locations['u_texsize']),
    new Uniform1i(context, locations['u_texture']),
    new Uniform1f(context, locations['u_gamma_scale']),
    new Uniform1f(context, locations['u_is_halo'])
]);


const symbolSDFUniformValues = (
    functionType: string,
    size: ?{uSizeT: number, uSize: number},
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number],
    isHalo: boolean
): UniformValues<SymbolSDFUniformsType> => {
    const transform = painter.transform;

    return symbolIconUniformValues(functionType, size, rotateInShader,
        pitchWithMap, painter, matrix, labelPlaneMatrix, glCoordMatrix,
        isText, texSize).concat([
            (pitchWithMap ? Math.cos(transform._pitch) * transform.cameraToCenterDistance : 1),
            +isHalo
    ]);
};

export { symbolIconUniforms, symbolSDFUniforms, symbolIconUniformValues, symbolSDFUniformValues };
