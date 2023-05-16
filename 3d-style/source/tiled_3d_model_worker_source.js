// @flow

import WorkerTile from '../../src/source/worker_tile.js';
import type Actor from '../../src/util/actor.js';
import {getArrayBuffer} from '../../src/util/ajax.js';
import type StyleLayerIndex from '../../src/style/style_layer_index.js';
import FeatureIndex from '../../src/data/feature_index.js';
import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters
} from '../../src/source/worker_source.js';
import convertModel from './model_loader.js';
import Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket.js';
import type {Bucket} from '../../src/data/bucket.js';
import {OverscaledTileID} from '../../src/source/tile_id.js';
import {parse} from '@loaders.gl/core';
import {Tiles3DLoader} from '@loaders.gl/3d-tiles';

async function parseTile(data: ArrayBuffer, layerIndex: StyleLayerIndex, params: WorkerTileParameters, callback: WorkerTileCallback) {
    const tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
    const buckets: {[_: string]: Bucket} = {};
    const layerFamilies = layerIndex.familiesBySource[params.source];
    const featureIndex = new FeatureIndex(tileID, params.promoteId);
    featureIndex.bucketLayerIDs = [];
    const b3dm = await parse(data, Tiles3DLoader,
        {worker: false, gltf: {decompressMeshes: true, postProcess: false, loadBuffers: true, loadImages: true}});
    const nodes = convertModel(b3dm.gltf);
    for (const sourceLayerId in layerFamilies) {
        for (const family of layerFamilies[sourceLayerId]) {
            const layer = family[0];
            const extensions = b3dm.gltf.json.extensionsUsed;
            buckets[layer.id] = new Tiled3dModelBucket(nodes, tileID, extensions && extensions.includes("MAPBOX_mesh_features"));
        }
    }
    // $FlowFixMe flow is complaining about missing properties and buckets not being of type Array
    callback(null, {buckets, featureIndex});
}

// $FlowIgnore[prop-missing] we don't need all Worker source properties
class Tiled3dModelWorkerSource implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;

    loading: {[_: number]: WorkerTile };
    loaded: {[_: number]: WorkerTile };
    brightness: ?number;
    constructor(actor: Actor, layerIndex: StyleLayerIndex, brightness: ?number) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.brightness = brightness;
    }

    async loadTile(params: WorkerTileParameters, callback: WorkerTileCallback): any {
        getArrayBuffer(params.request, (err: ?Error, data: ?ArrayBuffer) => {
            if (err) {
                return callback(err);
            }
            if (data) {
                return (parseTile(data, this.layerIndex, params, callback): any);
            }
        });
    }

    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    // eslint-disable-next-line no-unused-vars
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        // Needs implementation
    }

    /**
     * Aborts loading a tile that is in progress.
     */
    // eslint-disable-next-line no-unused-vars
    abortTile(params: TileParameters, callback: WorkerTileCallback) {
        // Needs implementation
    }

    /**
     * Removes this tile from any local caches.
     */
    // eslint-disable-next-line no-unused-vars
    removeTile(params: TileParameters, callback: WorkerTileCallback) {
        // Needs implementation
    }

}

export default Tiled3dModelWorkerSource;
