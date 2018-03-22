// @flow

import {
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';

type u_matrix = UniformMatrix4fv;
type u_camera_to_center_distance = Uniform1f;
type u_pixels_to_tile_units = Uniform1f;
type u_extrude_scale = Uniform2fv;
type u_overscale_factor = Uniform1f;

export type CollisionUniformsType = [
    u_matrix,
    u_camera_to_center_distance,
    u_pixels_to_tile_units,
    u_extrude_scale,
    u_overscale_factor
];

const collisionUniforms = (context: Context, locations: UniformLocations): CollisionUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_camera_to_center_distance']),
    new Uniform1f(context, locations['u_pixels_to_tile_units']),
    new Uniform2fv(context, locations['u_extrude_scale']),
    new Uniform1f(context, locations['u_overscale_factor'])
]);

const collisionUniformValues = (
    matrix: Float32Array,
    transform: Transform,
    tile: Tile
): UniformValues<CollisionUniformsType> => {
    const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
    const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
    const overscaleFactor = tile.tileID.overscaleFactor();
    return [
        matrix,
        transform.cameraToCenterDistance,
        pixelRatio,
        [transform.pixelsToGLUnits[0] / (pixelRatio * scale),
            transform.pixelsToGLUnits[1] / (pixelRatio * scale)],
        overscaleFactor
    ];
};

export { collisionUniforms, collisionUniformValues };
