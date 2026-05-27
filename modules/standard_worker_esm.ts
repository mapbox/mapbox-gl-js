import {warnOnce} from '../src/util/util';

// Live bindings — updated by `prepareStandard()` once the Standard chunk finishes loading.
// Readers (e.g. worker_tile) check `loaded` before invoking the hooks.
export let ModelBucket;
export let Tiled3dModelBucket;
export let loaded = false;

export async function prepareStandard(): Promise<void> {
    try {
        const mod = await import('./standard_worker_imports');
        ModelBucket = mod.ModelBucket;
        Tiled3dModelBucket = mod.Tiled3dModelBucket;
        loaded = true;
    } catch (error) {
        warnOnce('Could not load Standard module.');
    }
}
