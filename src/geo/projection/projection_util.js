// @flow
import type {OverscaledTileID} from '../../source/tile_id.js';
import type SymbolBucket from '../../data/bucket/symbol_bucket.js';
import type Transform from '../../geo/transform.js';
import type Projection from './projection.js';
import {mat4} from 'gl-matrix';
import assert from 'assert';

function reconstructTileMatrix(transform: Transform, projection: Projection, coord: OverscaledTileID) {
    // Bucket being rendered is built for different map projection
    // than is currently being used. Reconstruct correct matrices.
    // This code path may happen during a Globe - Mercator transition
    const tileMatrix = projection.createTileMatrix(transform, transform.worldSize, coord.toUnwrapped());
    return mat4.multiply(new Float32Array(16), transform.projMatrix, tileMatrix);
}

export function getCollisionDebugTileProjectionMatrix(coord: OverscaledTileID, bucket: SymbolBucket, transform: Transform): Float32Array {
    if (bucket.projection.name === transform.projection.name) {
        assert(coord.projMatrix);
        return coord.projMatrix;
    }
    const tr = transform.clone();
    tr.setProjection(bucket.projection);
    return reconstructTileMatrix(tr, bucket.getProjection(), coord);
}

export function getSymbolTileProjectionMatrix(coord: OverscaledTileID, bucketProjection: Projection, transform: Transform): Float32Array {
    if (bucketProjection.name === transform.projection.name) {
        assert(coord.projMatrix);
        return coord.projMatrix;
    }
    return reconstructTileMatrix(transform, bucketProjection, coord);
}

export function getSymbolPlacementTileProjectionMatrix(coord: OverscaledTileID, bucketProjection: Projection, transform: Transform, runtimeProjection: string): Float32Array {
    if (bucketProjection.name === runtimeProjection) {
        return transform.calculateProjMatrix(coord.toUnwrapped());
    }
    assert(transform.projection.name === bucketProjection.name);
    return reconstructTileMatrix(transform, bucketProjection, coord);
}
