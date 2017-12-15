// @flow

import { mat4 } from '@mapbox/gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    Uniform4fv,
    UniformMatrix4fv,
    Uniforms
} from '../uniform_binding';
import EXTENT from '../../data/extent';
import Coordinate from '../../geo/coordinate';

import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';
import type Tile from '../../source/tile';
import type Painter from '../painter';
import type HillshadeStyleLayer from '../../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../../source/tile_id';

export type HillshadeUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_image': Uniform1i,
    'u_latrange': Uniform2fv,
    'u_light': Uniform2fv,
    'u_shadow': Uniform4fv,
    'u_highlight': Uniform4fv,
    'u_accent': Uniform4fv
|};

export type HillshadePrepareUniformsType = {|
    'u_matrix': UniformMatrix4fv,
    'u_image': Uniform1i,
    'u_dimension': Uniform2fv,
    'u_zoom': Uniform1f,
    'u_maxzoom': Uniform1f
|};

const hillshadeUniforms = (context: Context): Uniforms<HillshadeUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_image': new Uniform1i(context),
    'u_latrange': new Uniform2fv(context),
    'u_light': new Uniform2fv(context),
    'u_shadow': new Uniform4fv(context),
    'u_highlight': new Uniform4fv(context),
    'u_accent': new Uniform4fv(context)
});

const hillshadePrepareUniforms = (context: Context): Uniforms<HillshadePrepareUniformsType> => new Uniforms({
    'u_matrix': new UniformMatrix4fv(context),
    'u_image': new Uniform1i(context),
    'u_dimension': new Uniform2fv(context),
    'u_zoom': new Uniform1f(context),
    'u_maxzoom': new Uniform1f(context)
});

const hillshadeUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: HillshadeStyleLayer
): UniformValues<HillshadeUniformsType> => {
    const shadow = layer.paint.get("hillshade-shadow-color");
    const highlight = layer.paint.get("hillshade-highlight-color");
    const accent = layer.paint.get("hillshade-accent-color");

    let azimuthal = layer.paint.get('hillshade-illumination-direction') * (Math.PI / 180);
    // modify azimuthal angle by map rotation if light is anchored at the viewport
    if (layer.paint.get('hillshade-illumination-anchor') === 'viewport') {
        azimuthal -= painter.transform.angle;
    }

    return {
        'u_matrix': painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped(), true),
        'u_image': 0,
        'u_latrange': getTileLatRange(painter, tile.tileID),
        'u_light': [layer.paint.get('hillshade-exaggeration'), azimuthal],
        'u_shadow': [shadow.r, shadow.g, shadow.b, shadow.a],
        'u_highlight': [highlight.r, highlight.g, highlight.b, highlight.a],
        'u_accent': [accent.r, accent.g, accent.b, accent.a]
    };
};

const hillshadeUniformPrepareValues = (
    tile: {dem: any, tileID: OverscaledTileID}, maxzoom: number
): UniformValues<HillshadePrepareUniformsType> => {
    const tileSize = tile.dem.level.dim;
    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    return {
        'u_matrix': matrix,
        'u_image': 1,
        'u_dimension': [tileSize * 2, tileSize * 2],
        'u_zoom': tile.tileID.overscaledZ,
        'u_maxzoom': maxzoom
    };
};

function getTileLatRange(painter: Painter, tileID: OverscaledTileID) {
    // for scaling the magnitude of a points slope by its latitude
    const coordinate0 = tileID.toCoordinate();
    const coordinate1 = new Coordinate(
        coordinate0.column, coordinate0.row + 1, coordinate0.zoom);
    return [
        painter.transform.coordinateLocation(coordinate0).lat,
        painter.transform.coordinateLocation(coordinate1).lat
    ];
}

export {
    hillshadeUniforms,
    hillshadePrepareUniforms,
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
};
