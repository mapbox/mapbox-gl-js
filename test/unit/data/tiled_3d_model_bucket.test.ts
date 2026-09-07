/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {mat4} from 'gl-matrix';
import {test, expect} from '../../util/vitest';
import Tiled3dModelBucket, {Tiled3dModelFeature} from '../../../3d-style/data/bucket/tiled_3d_model_bucket';
import {Aabb} from '../../../src/util/primitives';

import type {Mesh, ModelNode} from '../../../3d-style/data/model';

function createNodeWithNoBvhAndNoHeightmap(): ModelNode {
    const mesh = {
        aabb: new Aabb([0, 0, 0], [10, 10, 10])
    } as Mesh; // no `heightmap` populated, mirroring a tile-wide skipped bake

    return {
        id: 'landmark-node-without-bvh',
        globalMatrix: mat4.identity([]),
        meshes: [mesh],
        meshBVH: undefined,
        hidden: false // not hidden: render-time cutoff never marked it hidden
    } as ModelNode;
}

test('Tiled3dModelBucket#getHeightAtTileCoord does not throw when a node has neither meshBVH nor a baked heightmap', () => {
    const node = createNodeWithNoBvhAndNoHeightmap();

    // Bypass the full constructor (which needs a real FeatureIndex/layers/etc.) and set up just
    // the state getHeightAtTileCoord() actually reads, via the real Tiled3dModelFeature so mesh
    // AABBs get transformed exactly the way production code does.
    const bucket = Object.create(Tiled3dModelBucket.prototype) as Tiled3dModelBucket;
    bucket.filter = null;
    bucket.nodesInfo = [new Tiled3dModelFeature(node)];

    // A query point that falls inside the node's mesh AABB.
    // With no usable height data for this (only) node, the query should come back empty instead of crashing.
    expect(() => bucket.getHeightAtTileCoord(5, 5)).not.toThrow();
    expect(bucket.getHeightAtTileCoord(5, 5)).toBeUndefined();
});
