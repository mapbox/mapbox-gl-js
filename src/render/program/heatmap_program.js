// @flow

import { mat4 } from '@mapbox/gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type Tile from '../../source/tile';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Painter from '../painter';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';

type u_extrude_scale =  Uniform1f;
type u_intensity =  Uniform1f;
type u_matrix =  UniformMatrix4fv;
type u_matrix =  UniformMatrix4fv;
type u_world =  Uniform2fv;
type u_image =  Uniform1i;
type u_color_ramp =  Uniform1i;
type u_opacity =  Uniform1f;

export type HeatmapUniformsType = [
    u_matrix,
    u_extrude_scale,
    u_intensity
];

const heatmapUniforms = (context: Context, locations: UniformLocations): HeatmapUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_extrude_scale']),
    new Uniform1f(context, locations['u_intensity'])
]);

const heatmapUniformValues = (
    matrix: Float32Array,
    tile: Tile,
    zoom: number,
    intensity: number
): UniformValues<HeatmapUniformsType> => ([
    matrix,
    pixelsToTileUnits(tile, 1, zoom),
    intensity
]);

export type HeatmapTextureUniformsType = [
    u_matrix,
    u_world,
    u_image,
    u_color_ramp,
    u_opacity
];

const heatmapTextureUniforms = (context: Context, locations: UniformLocations): HeatmapTextureUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform2fv(context, locations['u_world']),
    new Uniform1i(context, locations['u_image']),
    new Uniform1i(context, locations['u_color_ramp']),
    new Uniform1f(context, locations['u_opacity'])
]);

const heatmapTextureUniformValues = (
    painter: Painter,
    layer: HeatmapStyleLayer,
    textureUnit: number,
    colorRampUnit: number
): UniformValues<HeatmapTextureUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return [
        matrix,
        [gl.drawingBufferWidth, gl.drawingBufferHeight],
        textureUnit,
        colorRampUnit,
        layer.paint.get('heatmap-opacity')
    ];
};

export {
    heatmapUniforms,
    heatmapTextureUniforms,
    heatmapUniformValues,
    heatmapTextureUniformValues
};
