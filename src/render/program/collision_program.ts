import {Uniform1f, Uniform2f, UniformMatrix4f} from '../uniform_binding';
import EXTENT from '../../style-spec/data/extent';
import {Uniform3f, type UniformValues} from '../uniform_binding';

import type {mat4} from 'gl-matrix';
import type Context from '../../gl/context';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';
import type Projection from '../../geo/projection/projection';

export type CollisionDebugDefinesType =
    | 'PROJECTION_GLOBE_VIEW'
    | 'PROJECTED_POS_ON_VIEWPORT';

export type CollisionUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_inv_rot_matrix']: UniformMatrix4f;
    ['u_camera_to_center_distance']: Uniform1f;
    ['u_extrude_scale']: Uniform2f;
    ['u_zoom_transition']: Uniform1f
    ['u_merc_center']: Uniform2f
    ['u_tile_id']: Uniform3f
};

export type CollisionCircleUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_inv_matrix']: UniformMatrix4f;
    ['u_camera_to_center_distance']: Uniform1f;
    ['u_viewport_size']: Uniform2f;
};

const collisionUniforms = (context: Context): CollisionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_extrude_scale': new Uniform2f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_merc_center': new Uniform2f(context),
    'u_tile_id': new Uniform3f(context),
});

const collisionCircleUniforms = (context: Context): CollisionCircleUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_inv_matrix': new UniformMatrix4f(context),
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_viewport_size': new Uniform2f(context)
});

const collisionUniformValues = (
    matrix: mat4,
    invMatrix: mat4,
    transform: Transform,
    globeToMercator: number,
    mercatorCenter: [number, number],
    tile: Tile,
    tileId: [number, number, number],
    projection: Projection,
): UniformValues<CollisionUniformsType> => {
    const pixelRatio = EXTENT / tile.tileSize;

    return {
        'u_matrix': matrix as Float32Array,
        'u_inv_rot_matrix': invMatrix as Float32Array,
        'u_camera_to_center_distance': transform.getCameraToCenterDistance(projection),
        'u_extrude_scale': [transform.pixelsToGLUnits[0] / pixelRatio,
            transform.pixelsToGLUnits[1] / pixelRatio],
        'u_zoom_transition': globeToMercator,
        'u_tile_id': tileId,
        'u_merc_center': mercatorCenter
    };
};

const collisionCircleUniformValues = (
    matrix: mat4,
    invMatrix: mat4,
    transform: Transform,
    projection: Projection,
): UniformValues<CollisionCircleUniformsType> => {
    return {
        'u_matrix': matrix as Float32Array,
        'u_inv_matrix': invMatrix as Float32Array,
        'u_camera_to_center_distance': transform.getCameraToCenterDistance(projection),
        'u_viewport_size': [transform.width, transform.height]
    };
};

export {collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues};
