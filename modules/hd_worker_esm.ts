import {warnOnce} from '../src/util/util';

import type {Bucket} from '../src/data/bucket';
import type {CanonicalTileID} from '../src/source/tile_id';
import type {VectorTile, VectorTileLayer} from '@mapbox/vector-tile';
import type {ElevationFeature} from '../3d-style/elevation/elevation_feature';
import type {PostprocessTileContext} from '../3d-style/elevation/evaluate_portal_graphs';
import type {IndoorTileOptions} from '../src/style/indoor_data';
import type {WorkerSourceActor} from '../src/source/worker_source';
import type {FrcCoveragePolygons} from '../src/source/frc_coverage_snapshot';

// Live bindings — updated by `prepareHD()` once the HD chunk finishes loading.
// Readers (e.g. worker_tile) check `loaded` before invoking the hooks.
export let BuildingBucket;
export let parseElevationFeatures: ((data: VectorTile, canonical: CanonicalTileID) => ElevationFeature[] | undefined) | undefined;
export let attachExtension: ((bucket: Bucket, coverageSourceLayers: string[] | null | undefined) => void) | undefined;
export let postprocessTile: ((ctx: PostprocessTileContext) => void) | undefined;
export let parseFrcCoverageFromLayer: ((layer: VectorTileLayer) => FrcCoveragePolygons) | undefined;
export let isFeatureCoveredByFrcMask: ((featureProperties: Record<string, unknown>, frcMask: number) => boolean) | undefined;
export let matchesCoverageSourceLayer: ((entries: string[], source: string, sourceLayer: string) => boolean) | undefined;
export let symbolAnchorInFrcCoverage: ((coveragePolygons: FrcCoveragePolygons, properties: Record<string, unknown>, anchor: {x: number; y: number}, canonical: CanonicalTileID, coverageTileZoom: number | null) => boolean) | undefined;
export let parseActiveFloors: ((data: VectorTile, indoorTileOptions: IndoorTileOptions, actor: WorkerSourceActor, tileID: CanonicalTileID) => Set<string> | undefined) | undefined;
export let anyDeferredElevationFeatures: ((buckets: Record<string, Bucket>) => boolean) | undefined;
let waitForBuildingGen: (() => Promise<void> | null) | undefined;
export let loaded = false;

export async function prepareHD() {
    try {
        const mod = await import('./hd_worker_imports');
        BuildingBucket = mod.BuildingBucket;
        parseElevationFeatures = mod.parseElevationFeatures;
        attachExtension = mod.attachExtension;
        postprocessTile = mod.postprocessTile;
        parseFrcCoverageFromLayer = mod.parseFrcCoverageFromLayer;
        isFeatureCoveredByFrcMask = mod.isFeatureCoveredByFrcMask;
        matchesCoverageSourceLayer = mod.matchesCoverageSourceLayer;
        symbolAnchorInFrcCoverage = mod.symbolAnchorInFrcCoverage;
        parseActiveFloors = mod.parseActiveFloors;
        anyDeferredElevationFeatures = mod.anyDeferredElevationFeatures;
        waitForBuildingGen = mod.waitForBuildingGen;
        loaded = true;
    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}

// Procedural-building geometry needs the building-gen WASM on top of the HD JS chunk.
// Kept separate from `prepareHD` so indoor / FRC / HD-elevation tiles — which only use
// the JS hooks — don't trigger the (large) WASM fetch. Only the `building` layer awaits this.
export async function prepareBuildingGen() {
    await prepareHD();
    if (waitForBuildingGen) await waitForBuildingGen();
}
