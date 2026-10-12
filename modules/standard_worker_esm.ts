import {warnOnce} from '../src/util/util';

// Live bindings — updated by `prepareStandard()` once the Standard chunk finishes loading.
// Readers (e.g. worker_tile) check `loaded` before invoking the hooks.
export let ModelBucket;
export let Tiled3dModelBucket;
export let Tiled3dModelWorkerSource;
export let loaded = false;

let pending: Promise<void> | null = null;

export function prepareStandard(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./standard_worker_imports').then((mod) => {
        ModelBucket = mod.ModelBucket;
        Tiled3dModelBucket = mod.Tiled3dModelBucket;
        Tiled3dModelWorkerSource = mod.Tiled3dModelWorkerSource;
        loaded = true;
    }).catch(() => {
        pending = null;
        warnOnce('Could not load Standard module.');
    });
    return pending;
}
