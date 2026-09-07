import {test, expect} from '../../util/vitest';
import {process3DTile} from '../../../3d-style/source/model_loader';
import {GLTF_FLOAT, GLTF_USHORT} from '../../../3d-style/util/loaders';

import type {GLTF} from '../../../3d-style/util/loaders';

// Regression test for process3DTile (3d-style/source/model_loader.ts). It used to gate the
// fallback heightmap bake on a single, document-wide flag:
//
//   const hasBVH = gltf.json.extensionsUsed && gltf.json.extensionsUsed.includes('mbx_bvh');
//   if (!hasBVH) { for (const mesh of node.meshes) parseHeightmap(mesh); }
//
// `extensionsUsed` is true as soon as *any* node in the glTF uses `mbx_bvh`, but a node's own
// `meshBVH` is only populated per-node (own extension, or inherited from a child/LOD
// counterpart). A node with neither ended up with NO height data at all: no BVH and no baked
// heightmap, which crashed the query-time height lookup (Tiled3dModelBucket#getHeightAtTileCoord)
// and, once that crash was silenced by skipping such nodes, silently dropped their height
// entirely (a landmark's roof label would sit on the ground, and POIs that should be hidden
// behind the building would stay visible).
function buildSingleTriangleGltf(): GLTF {
    const positions = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
    const indices = new Uint16Array([0, 1, 2]);

    return {
        json: {
            extensionsUsed: ['mbx_bvh'], // some OTHER node in the tile uses the extension
            accessors: [
                {count: 3, type: 'VEC3', componentType: GLTF_FLOAT, bufferView: 0, min: [0, 0, 0], max: [10, 10, 0]},
                {count: 3, type: 'SCALAR', componentType: GLTF_USHORT, bufferView: 1}
            ],
            bufferViews: [
                {buffer: 0, byteLength: positions.byteLength},
                {buffer: 1, byteLength: indices.byteLength}
            ],
            materials: [],
            meshes: [{primitives: [{indices: 1, attributes: {POSITION: 0}, extensions: {}}]}],
            nodes: [{mesh: 0}], // no `extensions`: this node has no BVH of its own to load or inherit
            scene: 0,
            scenes: [{nodes: [0]}]
        },
        images: [],
        buffers: [positions.buffer, indices.buffer]
    } as unknown as GLTF;
}

test('process3DTile bakes a heightmap for a node without its own BVH, even when the tile-wide extensionsUsed flag is set', () => {
    const gltf = buildSingleTriangleGltf();

    const [node] = process3DTile(gltf, 1);

    expect(node.meshBVH).toBeUndefined();
    expect(node.meshes[0].heightmap).toBeDefined();
});
