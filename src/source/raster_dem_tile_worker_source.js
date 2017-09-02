// @flow

const {DEMData} = require('../data/dem_data');
import type {SerializedDEMData} from '../data/dem_data';
import type Actor from '../util/actor';
import type {TileParameters} from './worker_source';
import type {RGBAImage} from '../util/image';
import type TileCoord from './tile_coord';


class RasterDEMTileWorkerSource {
    actor: Actor;
    loading: {[string]: {[string]: DEMData}};
    loaded: {[string]: {[string]: DEMData}};

    constructor(actor: Actor) {
        this.actor = actor;
        this.loading = {};
        this.loaded = {};
    }

    /**
     * Implements {@link WorkerSource#loadTile}.
     */
    loadTile(params: TileParameters & {
                rawImageData: RGBAImage,
                coord: TileCoord,
                type: string
            }, callback: (err: ?Error, result: ?SerializedDEMData, transferrables: ?Array<Transferable>) => void) {
        const source = params.source,
            uid = params.uid;

        if (!this.loading[source])
            this.loading[source] = {};

        const dem = new DEMData(uid);
        this.loading[source][uid] = dem;
        dem.loadFromImage(params.rawImageData);
        const transferrables = [];

        this.loaded[source] = this.loaded[source] || {};
        this.loaded[source][uid] = dem;
        callback(null, dem.serialize(transferrables), transferrables);
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params
     * @param params.source The id of the source for which we're loading this tile.
     * @param params.uid The UID for this tile.
     */
    removeTile(params: TileParameters) {
        const loaded = this.loaded[params.source],
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

module.exports = RasterDEMTileWorkerSource;
