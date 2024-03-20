// @flow

import {getArrayBuffer} from '../../src/util/ajax.js';
import FeatureIndex from '../../src/data/feature_index.js';
import {process3DTile} from './model_loader.js';
import {tileToMeter} from '../../src/geo/mercator_coordinate.js';
import Tiled3dModelBucket from '../data/bucket/tiled_3d_model_bucket.js';
import {CanonicalTileID, OverscaledTileID} from '../../src/source/tile_id.js';
import {load3DTile} from '../util/loaders.js';
import EvaluationParameters from '../../src/style/evaluation_parameters.js';

import type Actor from '../../src/util/actor.js';
import type StyleLayerIndex from '../../src/style/style_layer_index.js';
import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters,
    WorkerTileResult
} from '../../src/source/worker_source.js';
import type {Bucket} from '../../src/data/bucket.js';
import type Projection from '../../src/geo/projection/projection.js';

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
        this.projection = params.projection;
        this.brightness = brightness;
    }

    parse(data: ArrayBuffer, layerIndex: StyleLayerIndex, params: WorkerTileParameters, callback: WorkerTileCallback): Promise<void> {
        this.status = 'parsing';
        const tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        const buckets: {[_: string]: Bucket} = {};
        const layerFamilies = layerIndex.familiesBySource[params.source];
        const featureIndex = new FeatureIndex(tileID, params.promoteId);
        featureIndex.bucketLayerIDs = [];
        featureIndex.is3DTile = true;

        return load3DTile(data)
            .then(gltf => {
                if (!gltf) return callback(new Error('Could not parse tile'));
                const nodes = process3DTile(gltf, 1.0 / tileToMeter(params.tileID.canonical));
                const hasMapboxMeshFeatures = (gltf.json.extensionsUsed && gltf.json.extensionsUsed.includes('MAPBOX_mesh_features')) ||
                                            (gltf.json.asset.extras && gltf.json.asset.extras['MAPBOX_mesh_features']);
                const hasMeshoptCompression = gltf.json.extensionsUsed && gltf.json.extensionsUsed.includes('EXT_meshopt_compression');

                const parameters = new EvaluationParameters(this.zoom, {brightness: this.brightness});
                for (const sourceLayerId in layerFamilies) {
                    for (const family of layerFamilies[sourceLayerId]) {
                        const layer = family[0];
                        featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
                        layer.recalculate(parameters, []);
                        const bucket = new Tiled3dModelBucket(nodes, tileID, hasMapboxMeshFeatures, hasMeshoptCompression, this.brightness, featureIndex);
                        // Upload to GPU without waiting for evaluation if we are in diffuse path
                        if (!hasMapboxMeshFeatures) bucket.needsUpload = true;
                        buckets[layer.fqid] = bucket;
                        // do the first evaluation in the worker to avoid stuttering
                        // $FlowIgnore[incompatible-call] layer here is always a ModelStyleLayer
                        bucket.evaluate(layer);
                    }
                }
                this.status = 'done';
                // $FlowFixMe flow is complaining about missing properties and buckets not being of type Array
                callback(null, {buckets, featureIndex});
            })
            .catch((err) => callback(new Error(err.message)));
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
