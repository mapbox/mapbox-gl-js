import FillBucket from '../src/data/bucket/fill_bucket';
import LineBucket from '../src/data/bucket/line_bucket';
import CircleBucket from '../src/data/bucket/circle_bucket';
import SymbolBucket from '../src/data/bucket/symbol_bucket';
import {maybeAttachFillHDExt} from '../3d-style/data/bucket/fill_hd_extension';
import {maybeAttachLineHDExt} from '../3d-style/data/bucket/line_hd_extension';
import {maybeAttachCircleHDExt} from '../3d-style/data/bucket/circle_hd_extension';
import {maybeAttachSymbolHDExt} from '../3d-style/data/bucket/symbol_hd_extension';

import type {Bucket} from '../src/data/bucket';

export {
    BuildingBucket,
    waitForBuildingGen
} from '../3d-style/data/bucket/building_bucket';
export {parseElevationFeatures} from '../3d-style/elevation/parse_elevation_features';
export {evaluatePortalGraphs as postprocessTile} from '../3d-style/elevation/evaluate_portal_graphs';
export {parseFrcCoverageFromLayer} from '../3d-style/source/frc_coverage_parser';
export {isFeatureCoveredByFrcMask, matchesCoverageSourceLayer} from '../3d-style/data/frc_road_classes';
export {symbolAnchorInFrcCoverage} from '../3d-style/symbol/frc_symbol_filter';

export {parseActiveFloors} from '../3d-style/source/indoor_parser';

/**
 * Dispatches HD extension attachment to the bucket-type-specific helper. Called from
 * `WorkerTile.parse` immediately after `layer.createBucket()` so the relevance check
 * and the concrete extension class stay out of core.
 *
 * @private
 */
export function attachExtension(bucket: Bucket, coverageSourceLayers: string[] | null | undefined): void {
    if (bucket instanceof FillBucket) {
        maybeAttachFillHDExt(bucket, coverageSourceLayers);
    } else if (bucket instanceof LineBucket) {
        maybeAttachLineHDExt(bucket, coverageSourceLayers);
    } else if (bucket instanceof CircleBucket) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        maybeAttachCircleHDExt(bucket);
    } else if (bucket instanceof SymbolBucket) {
        maybeAttachSymbolHDExt(bucket);
    }
}

/**
 * True when any bucket deferred elevation lookup pending provider readiness.
 *
 * Cross-source defer is line-only: `LineHDExtension` is the sole bucket type that
 * sets `hasDeferredElevationFeatures` when an id is present but providers haven't settled.
 *
 * @private
 */
export function anyDeferredElevationFeatures(buckets: Record<string, Bucket>): boolean {
    for (const key in buckets) {
        const bucket = buckets[key];
        if (bucket instanceof LineBucket && bucket.hdExt && bucket.hdExt.hasDeferredElevationFeatures) {
            return true;
        }
    }
    return false;
}
