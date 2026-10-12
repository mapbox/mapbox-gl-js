import {warnOnce} from '../src/util/util';

// Live binding — set by `prepareRasterArray()` once the raster-array worker chunk finishes
// loading. The worker checks it before invoking the source.
export let RasterArrayTileWorkerSource;

let pending: Promise<void> | null = null;

export function prepareRasterArray(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./raster_array_worker_imports').then((mod) => {
        RasterArrayTileWorkerSource = mod.RasterArrayTileWorkerSource;
    }).catch(() => {
        pending = null;
        warnOnce('Could not load raster-array module.');
    });
    return pending;
}
