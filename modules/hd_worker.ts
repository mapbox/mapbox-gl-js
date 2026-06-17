import {
    BuildingBucket,
    waitForBuildingGen,
    parseElevationFeatures,
    attachExtension,
    postprocessTile,
    parseFrcCoverageFromLayer,
    isFeatureCoveredByFrcMask,
    matchesCoverageSourceLayer,
    symbolAnchorInFrcCoverage,
    parseActiveFloors,
    anyDeferredElevationFeatures,
} from './hd_worker_imports';

export {
    BuildingBucket,
    parseElevationFeatures,
    attachExtension,
    postprocessTile,
    parseFrcCoverageFromLayer,
    isFeatureCoveredByFrcMask,
    matchesCoverageSourceLayer,
    symbolAnchorInFrcCoverage,
    parseActiveFloors,
    anyDeferredElevationFeatures,
};

// Live in UMD builds: HD is always loaded because all symbols are resolved
// synchronously at bundle load time. ESM exposes the same shape but lazily.
export const loaded = true;

// The HD JS chunk is always present in UMD, so `prepareHD` is a no-op. The building-gen
// WASM is still fetched lazily on first use — only by the `building` layer via
// `prepareBuildingGen`, matching the ESM split.
export async function prepareHD() {}

export async function prepareBuildingGen() { return waitForBuildingGen(); }
