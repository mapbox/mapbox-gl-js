// @flow

import { mat4 } from 'gl-matrix';

import {
    Uniform1i,
    Uniform2f,
    UniformColor,
    UniformMatrix4f
} from '../uniform_binding';
import EXTENT from '../../data/extent';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Painter from '../painter';

import Color from '../../style-spec/util/color';

export type HillshadeUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_light': Uniform2f,
    'u_shadow': UniformColor,
    'u_highlight': UniformColor,
    'u_accent': UniformColor
|};

export type HillshadePrepareUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_dimension': Uniform2f
|};

const hillshadeUniforms = (context: Context, locations: UniformLocations): HillshadeUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_light': new Uniform2f(context, locations.u_light),
    'u_shadow': new UniformColor(context, locations.u_shadow),
    'u_highlight': new UniformColor(context, locations.u_highlight),
    'u_accent': new UniformColor(context, locations.u_accent)
});

const hillshadePrepareUniforms = (context: Context, locations: UniformLocations): HillshadePrepareUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_dimension': new Uniform2f(context, locations.u_dimension)
});

const hillshadeUniformValues = (
    painter: Painter
): UniformValues<HillshadeUniformsType> => {

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const shadow = Color.black;
    const highlight = Color.white;
    const accent = Color.red;

    let azimuthal = 335 * (Math.PI / 180);
    // modify azimuthal angle by map rotation if light is anchored at the viewport
    azimuthal -= painter.transform.angle;
    const gl = painter.context.gl;


    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': 0,
        'u_light': [0.5, azimuthal],
        'u_shadow': shadow,
        'u_highlight': highlight,
        'u_accent': accent
    };
};

const hillshadeUniformPrepareValues = (
    painter: Painter
): UniformValues<HillshadePrepareUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, -painter.height, 0, 0, 1);
    // Flip rendering at y axis.
    mat4.translate(matrix, matrix, [0, -painter.height, 0]);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': 1,
        'u_dimension': [gl.drawingBufferWidth, gl.drawingBufferHeight]
    };
};

export {
    hillshadeUniforms,
    hillshadePrepareUniforms,
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
};
