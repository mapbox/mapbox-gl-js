import type {OverscaledTileID} from '../../source/tile_id';
import type SymbolBucket from '../../data/bucket/symbol_bucket';
import type Transform from '../../geo/transform';
import type Projection from './projection';
import {mat4} from 'gl-matrix';
import assert from 'assert';

function reconstructTileMatrix(transform: Transform, projection: Projection, coord: OverscaledTileID) {
    // Bucket being rendered is built for different map projection
    // than is currently being used. Reconstruct correct matrices.
    // This code path may happen during a Globe - Mercator transition
    const tileMatrix = projection.createTileMatrix(transform, transform.worldSize, coord.toUnwrapped());
    // @ts-expect-error - TS2345 - Argument of type 'number[] | Float32Array | Float64Array' is not assignable to parameter of type 'ReadonlyMat4'.
    return mat4.multiply(new Float32Array(16), transform.projMatrix, tileMatrix);
}

export function getCollisionDebugTileProjectionMatrix(coord: OverscaledTileID, bucket: SymbolBucket, transform: Transform): Float32Array {
    if (bucket.projection.name === transform.projection.name) {
        assert(coord.projMatrix);
        return coord.projMatrix;
    }
    const tr = transform.clone();
    tr.setProjection(bucket.projection);
    // @ts-expect-error - TS2322 - Type 'mat4' is not assignable to type 'Float32Array'.
    return reconstructTileMatrix(tr, bucket.getProjection(), coord);
}

export function getSymbolTileProjectionMatrix(
    coord: OverscaledTileID,
    bucketProjection: Projection,
    transform: Transform,
): Float32Array {
    if (bucketProjection.name === transform.projection.name) {
        assert(coord.projMatrix);
        return coord.projMatrix;
    }
    // @ts-expect-error - TS2322 - Type 'mat4' is not assignable to type 'Float32Array'.
    return reconstructTileMatrix(transform, bucketProjection, coord);
}

export function getSymbolPlacementTileProjectionMatrix(
    coord: OverscaledTileID,
    bucketProjection: Projection,
    transform: Transform,
    runtimeProjection: string,
): Float32Array {
    if (bucketProjection.name === runtimeProjection) {
        return transform.calculateProjMatrix(coord.toUnwrapped());
    }
    assert(transform.projection.name === bucketProjection.name);
    // @ts-expect-error - TS2322 - Type 'mat4' is not assignable to type 'Float32Array'.
    return reconstructTileMatrix(transform, bucketProjection, coord);
}
