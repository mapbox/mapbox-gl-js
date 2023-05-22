// @flow

import type Actor from '../../src/util/actor.js';
import {getArrayBuffer} from '../../src/util/ajax.js';
import type StyleLayerIndex from '../../src/style/style_layer_index.js';
import FeatureIndex from '../../src/data/feature_index.js';
import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters,
    WorkerTileResult
} from '../../src/source/worker_source.js';
import {convertB3dm} from './model_loader.js';
import {tileToMeter} from '../../src/geo/mercator_coordinate.js';
import Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket.js';
import type {Bucket} from '../../src/data/bucket.js';
import {CanonicalTileID, OverscaledTileID} from '../../src/source/tile_id.js';
import type Projection from '../../src/geo/projection/projection.js';
import {parse} from '@loaders.gl/core';
import {Tiles3DLoader} from '@loaders.gl/3d-tiles';

class Tiled3dWorkerTile {
    tileID: OverscaledTileID;
    uid: number;
    zoom: number;
    tileZoom: number;
    canonical: CanonicalTileID;
    pixelRatio: number;
    tileSize: number;
    source: string;
    overscaling: number;
    enableTerrain: boolean;
    projection: Projection;
    status: 'parsing' | 'done';
    reloadCallback: ?WorkerTileCallback;
    data: ArrayBuffer;

    constructor(params: WorkerTileParameters) {
        this.tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.tileZoom = params.tileZoom;
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.canonical = params.tileID.canonical;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = this.tileID.overscaleFactor();
        this.enableTerrain = !!params.enableTerrain;
        this.projection = params.projection;
    }

    async parse(data: ArrayBuffer, layerIndex: StyleLayerIndex, params: WorkerTileParameters, callback: WorkerTileCallback) {
        this.status = 'parsing';
        const tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        const buckets: {[_: string]: Bucket} = {};
        const layerFamilies = layerIndex.familiesBySource[params.source];
        const featureIndex = new FeatureIndex(tileID, params.promoteId);
        featureIndex.bucketLayerIDs = [];
        const b3dm = await parse(data, Tiles3DLoader,
            {worker: false, gltf: {decompressMeshes: true, postProcess: false, loadBuffers: true, loadImages: true}});
        const nodes = convertB3dm(b3dm.gltf, 1.0 / tileToMeter(params.tileID.canonical));
        for (const sourceLayerId in layerFamilies) {
            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];
                const extensions = b3dm.gltf.json.extensionsUsed;
                const bucket = new Tiled3dModelBucket(nodes, tileID, extensions && extensions.includes("MAPBOX_mesh_features"));
                // $FlowIgnore[incompatible-call] we are sure layer is a ModelStyleLayer here.
                bucket.evaluate((layer));
                buckets[layer.id] = bucket;
            }
        }
        this.status = 'done';
        // $FlowFixMe flow is complaining about missing properties and buckets not being of type Array
        callback(null, {buckets, featureIndex});
    }
}

// $FlowIgnore[prop-missing] we don't need all Worker source properties
class Tiled3dModelWorkerSource implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;

    loading: {[_: number]: Tiled3dWorkerTile };
    loaded: {[_: number]: Tiled3dWorkerTile };
    brightness: ?number;
    constructor(actor: Actor, layerIndex: StyleLayerIndex, brightness: ?number) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.brightness = brightness;
        this.loading = {};
        this.loaded = {};
    }

    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;
        const workerTile = this.loading[uid] = new Tiled3dWorkerTile(params);
        getArrayBuffer(params.request, (err: ?Error, data: ?ArrayBuffer) => {
            const aborted = !this.loading[uid];
            delete this.loading[uid];

            if (aborted || err) {
                workerTile.status = 'done';
                if (!aborted) this.loaded[uid] = workerTile;
                return callback(err);
            }
            if (data) {
                // Store rawdata
                workerTile.data = data;
                workerTile.parse(data, this.layerIndex, params, callback);
            }
            this.loaded = this.loaded || {};
            this.loaded[uid] = workerTile;
        });
    }

    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    // eslint-disable-next-line no-unused-vars
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded;
        const uid = params.uid;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            workerTile.enableTerrain = !!params.enableTerrain;
            workerTile.projection = params.projection;

            const done = (err: ?Error, data: ?WorkerTileResult) => {
                const reloadCallback = workerTile.reloadCallback;
                if (reloadCallback) {
                    delete workerTile.reloadCallback;
                    workerTile.parse(workerTile.data, this.layerIndex, params, callback);
                }
                callback(err, data);
            };

            if (workerTile.status === 'parsing') {
                workerTile.reloadCallback = done;
            } else if (workerTile.status === 'done') {
                // reparse data if the tile is present
                if (workerTile.data) {
                    workerTile.parse(workerTile.data, this.layerIndex, params, callback);
                } else {
                    // If there is no data, load do the request again
                    this.loadTile(params, callback);
                }
            }
        }
    }

    /**
     * Aborts loading a tile that is in progress.
     */
    // eslint-disable-next-line no-unused-vars
    abortTile(params: TileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;
        const tile = this.loading[uid];
        if (tile) {
            delete this.loading[uid];
        }
        callback();
    }

    /**
     * Removes this tile from any local caches.
     */
    // eslint-disable-next-line no-unused-vars
    removeTile(params: TileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
        callback();
    }

}

export default Tiled3dModelWorkerSource;
