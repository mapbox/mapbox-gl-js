import {warnOnce} from '../src/util/util';
import {updateFrcCoverageFadeRange} from '../3d-style/style/frc_coverage_eager';

import type {HD as HDType} from './hd_main_imports';

// `updateFrcCoverageFadeRange` is pure config-walking — it must run before the first
// tile request to set `painter.frcCoverageFadeRange` (read by `vector_tile_source`
// when building worker tile params). Importing it statically pulls it into core.
// Rest of HD stays lazy.
export const HD: Partial<typeof HDType> = {
    updateFrcCoverageFadeRange,
};

export async function prepareHD() {
    try {
        const {HD: hdModule} = await import('./hd_main_imports');
        Object.assign(HD, hdModule);
    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}
