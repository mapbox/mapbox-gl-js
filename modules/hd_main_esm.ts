import {warnOnce} from '../src/util/util';
import {updateFrcCoverageFadeRange} from '../3d-style/style/frc_coverage_eager';
import {buildElevationRequestParams} from '../3d-style/source/elevation_coverage_snapshot';

import type {HD as HDType} from './hd_main_imports';

// `updateFrcCoverageFadeRange` is pure config-walking — it must run before the first
// tile request to set `painter.frcCoverageFadeRange` (read by `vector_tile_source`
// when building worker tile params). Importing it statically pulls it into core.
// `buildElevationRequestParams` is likewise needed before the first tile load so that
// cross-source elevation stubs are generated even when the full HD chunk hasn't loaded yet.
// Rest of HD stays lazy.
export const HD: Partial<typeof HDType> = {
    updateFrcCoverageFadeRange,
    buildElevationRequestParams,
};

let pending: Promise<void> | null = null;

export function prepareHD(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./hd_main_imports').then(({HD: hdModule}) => {
        Object.assign(HD, hdModule);
    }).catch(() => {
        pending = null;
        warnOnce('Could not load HD module.');
    });
    return pending;
}
