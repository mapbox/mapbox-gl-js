// @flow

import { mat4 } from '@mapbox/gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformColor,
    UniformMatrix4fv
} from '../uniform_binding';
import EXTENT from '../../data/extent';
import Coordinate from '../../geo/coordinate';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Tile from '../../source/tile';
import type Painter from '../painter';
import type HillshadeStyleLayer from '../../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../../source/tile_id';

type u_matrix = UniformMatrix4fv;
type u_image = Uniform1i;
type u_latrange = Uniform2fv;
type u_light = Uniform2fv;
type u_shadow = UniformColor;
type u_highlight = UniformColor;
type u_accent = UniformColor;
type u_matrix = UniformMatrix4fv;
type u_image = Uniform1i;
type u_dimension = Uniform2fv;
type u_zoom = Uniform1f;
type u_maxzoom = Uniform1f;

export type HillshadeUniformsType = [
    u_matrix,
    u_image,
    u_latrange,
    u_light,
    u_shadow,
    u_highlight,
    u_accent
];

const hillshadeUniforms = (context: Context, locations: UniformLocations): HillshadeUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1i(context, locations['u_image']),
    new Uniform2fv(context, locations['u_latrange']),
    new Uniform2fv(context, locations['u_light']),
    new UniformColor(context, locations['u_shadow']),
    new UniformColor(context, locations['u_highlight']),
    new UniformColor(context, locations['u_accent'])
]);

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

    return [
        painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped(), true),
        0,
        getTileLatRange(painter, tile.tileID),
        [layer.paint.get('hillshade-exaggeration'), azimuthal],
        shadow,
        highlight,
        accent
    ];
};

export type HillshadePrepareUniformsType = [
    u_matrix,
    u_image,
    u_dimension,
    u_zoom,
    u_maxzoom
];

const hillshadePrepareUniforms = (context: Context, locations: UniformLocations): HillshadePrepareUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1i(context, locations['u_image']),
    new Uniform2fv(context, locations['u_dimension']),
    new Uniform1f(context, locations['u_zoom']),
    new Uniform1f(context, locations['u_maxzoom'])
]);

const hillshadeUniformPrepareValues = (
    tile: {dem: any, tileID: OverscaledTileID}, maxzoom: number
): UniformValues<HillshadePrepareUniformsType> => {
    const tileSize = tile.dem.level.dim;
    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    return [
        matrix,
        1,
        [tileSize * 2, tileSize * 2],
        tile.tileID.overscaledZ,
        maxzoom
    ];
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
