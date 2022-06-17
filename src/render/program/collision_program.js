// @flow

import {
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding.js';
import EXTENT from '../../data/extent.js';
import type Context from '../../gl/context.js';
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
import type Transform from '../../geo/transform.js';
import type Tile from '../../source/tile.js';
import type Projection from '../../geo/projection/projection.js';

export type CollisionUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_camera_to_center_distance': Uniform1f,
    'u_extrude_scale': Uniform2f
|};

export type CollisionCircleUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_inv_matrix': UniformMatrix4f,
    'u_camera_to_center_distance': Uniform1f,
    'u_viewport_size': Uniform2f
|};

const collisionUniforms = (context: Context, locations: UniformLocations): CollisionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale)
});

const collisionCircleUniforms = (context: Context, locations: UniformLocations): CollisionCircleUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_inv_matrix': new UniformMatrix4f(context, locations.u_inv_matrix),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_viewport_size': new Uniform2f(context, locations.u_viewport_size)
});

const collisionUniformValues = (
    matrix: Float32Array,
    transform: Transform,
    tile: Tile,
    projection: Projection
): UniformValues<CollisionUniformsType> => {
    const pixelRatio = EXTENT / tile.tileSize;

    return {
        'u_matrix': matrix,
        'u_camera_to_center_distance': transform.getCameraToCenterDistance(projection),
        'u_extrude_scale': [transform.pixelsToGLUnits[0] / pixelRatio,
            transform.pixelsToGLUnits[1] / pixelRatio]
    };
};

const collisionCircleUniformValues = (
    matrix: Float32Array,
    invMatrix: Float32Array,
    transform: Transform,
    projection: Projection
): UniformValues<CollisionCircleUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_inv_matrix': invMatrix,
        'u_camera_to_center_distance': transform.getCameraToCenterDistance(projection),
        'u_viewport_size': [transform.width, transform.height]
    };
};

export {collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues};
