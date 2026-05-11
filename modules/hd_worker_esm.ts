import {warnOnce} from '../src/util/util';

import type {Bucket} from '../src/data/bucket';
import type {CanonicalTileID} from '../src/source/tile_id';
import type {VectorTile} from '@mapbox/vector-tile';
import type {ElevationFeature} from '../3d-style/elevation/elevation_feature';
import type {PostprocessTileContext} from '../3d-style/elevation/evaluate_portal_graphs';
import type {IndoorTileOptions} from '../src/style/indoor_data';
import type Actor from '../src/util/actor';

// Live bindings — updated by `prepareHD()` once the HD chunk finishes loading.
// Readers (e.g. worker_tile) check `loaded` before invoking the hooks.
export let BuildingBucket;
export let parseElevationFeatures: ((data: VectorTile, canonical: CanonicalTileID) => ElevationFeature[] | undefined) | undefined;
export let attachExtension: ((bucket: Bucket) => void) | undefined;
export let postprocessTile: ((ctx: PostprocessTileContext) => void) | undefined;
export let parseActiveFloors: ((data: VectorTile, indoorTileOptions: IndoorTileOptions, actor: Actor, tileID: CanonicalTileID) => Set<string> | undefined) | undefined;
export let loaded = false;

export async function prepareHD() {
    try {
        const mod = await import('./hd_worker_imports');
        await mod.waitForBuildingGen();
        BuildingBucket = mod.BuildingBucket;
        parseElevationFeatures = mod.parseElevationFeatures;
        attachExtension = mod.attachExtension;
        postprocessTile = mod.postprocessTile;
        parseActiveFloors = mod.parseActiveFloors;
        loaded = true;
    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}
