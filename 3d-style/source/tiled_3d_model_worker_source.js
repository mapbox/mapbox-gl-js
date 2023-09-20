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
import {load3DTile} from '../util/loaders.js';

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
    brightness: ?number;

    constructor(params: WorkerTileParameters, brightness: ?number) {
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
        this.brightness = brightness;
    }

    async parse(data: ArrayBuffer, layerIndex: StyleLayerIndex, params: WorkerTileParameters, callback: WorkerTileCallback): Promise<void> {
        this.status = 'parsing';
        const tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        const buckets: {[_: string]: Bucket} = {};
        const layerFamilies = layerIndex.familiesBySource[params.source];
        const featureIndex = new FeatureIndex(tileID, params.promoteId);
        featureIndex.bucketLayerIDs = [];

        const b3dm = await load3DTile(data).catch((err) => callback(new Error(err.message)));
        if (!b3dm) return callback(new Error('Could not parse tile'));

        const nodes = convertB3dm(b3dm.gltf, 1.0 / tileToMeter(params.tileID.canonical));
        const hasMapboxMeshFeatures = b3dm.gltf.json.extensionsUsed && b3dm.gltf.json.extensionsUsed.includes('MAPBOX_mesh_features');
        for (const sourceLayerId in layerFamilies) {
            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];
                const extensions = b3dm.gltf.json.extensionsUsed;
                const bucket = new Tiled3dModelBucket(nodes, tileID, extensions && extensions.includes("MAPBOX_mesh_features"), this.brightness);
                // Upload to GPU without waiting for evaluation if we are in diffuse path
                if (!hasMapboxMeshFeatures) bucket.needsUpload = true;
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
    constructor(actor: Actor, layerIndex: StyleLayerIndex, availableImages: Array<string>, isSpriteLoaded: boolean, loadVectorData: ?any, brightness: ?number) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.brightness = brightness;
        this.loading = {};
        this.loaded = {};
    }

    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;
        const workerTile = this.loading[uid] = new Tiled3dWorkerTile(params, this.brightness);
        getArrayBuffer(params.request, (err: ?Error, data: ?ArrayBuffer) => {
            const aborted = !this.loading[uid];
            delete this.loading[uid];

            if (aborted || err) {
                workerTile.status = 'done';
                if (!aborted) this.loaded[uid] = workerTile;
                return callback(err);
            }

            if (!data || data.byteLength === 0) {
                workerTile.status = 'done';
                this.loaded[uid] = workerTile;
                return callback();
            }

            const workerTileCallback = (err: ?Error, result: ?WorkerTileResult) => {
                workerTile.status = 'done';
                this.loaded = this.loaded || {};
                this.loaded[uid] = workerTile;

                if (err || !result) callback(err);
                else callback(null, result);
            };

            workerTile.parse(data, this.layerIndex, params, workerTileCallback);
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
            workerTile.brightness = params.brightness;

            const done = (err: ?Error, data: ?WorkerTileResult) => {
                const reloadCallback = workerTile.reloadCallback;
                if (reloadCallback) {
                    delete workerTile.reloadCallback;
                    this.loadTile(params, callback);
                }
                callback(err, data);
            };

            if (workerTile.status === 'parsing') {
                workerTile.reloadCallback = done;
            } else if (workerTile.status === 'done') {
                // do the request again
                this.loadTile(params, callback);
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
