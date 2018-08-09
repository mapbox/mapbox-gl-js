// @flow

import assert from 'assert';
import { mat4 } from 'gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformMatrix4f
} from '../uniform_binding';
import EXTENT from '../../data/extent';
import Coordinate from '../../geo/coordinate';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Tile from '../../source/tile';
import type Painter from '../painter';
import type HillshadeStyleLayer from '../../style/style_layer/hillshade_style_layer';
import type DEMData from '../../data/dem_data';
import type {OverscaledTileID} from '../../source/tile_id';

export type HillshadeUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_latrange': Uniform2f,
    'u_light': Uniform2f,
    'u_shadow': UniformColor,
    'u_highlight': UniformColor,
    'u_accent': UniformColor
|};

export type HillshadePrepareUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_dimension': Uniform2f,
    'u_zoom': Uniform1f,
    'u_maxzoom': Uniform1f
|};

const hillshadeUniforms = (context: Context, locations: UniformLocations): HillshadeUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_latrange': new Uniform2f(context, locations.u_latrange),
    'u_light': new Uniform2f(context, locations.u_light),
    'u_shadow': new UniformColor(context, locations.u_shadow),
    'u_highlight': new UniformColor(context, locations.u_highlight),
    'u_accent': new UniformColor(context, locations.u_accent)
});

const hillshadePrepareUniforms = (context: Context, locations: UniformLocations): HillshadePrepareUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_zoom': new Uniform1f(context, locations.u_zoom),
    'u_maxzoom': new Uniform1f(context, locations.u_maxzoom)
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
        'u_shadow': shadow,
        'u_highlight': highlight,
        'u_accent': accent
    };
};

const hillshadeUniformPrepareValues = (
    tile: {dem: ?DEMData, tileID: OverscaledTileID}, maxzoom: number
): UniformValues<HillshadePrepareUniformsType> => {
    assert(tile.dem);
    const tileSize = ((tile.dem: any): DEMData).dim;
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
