import {warnOnce} from '../src/util/util';

export let BuildingBucket;

export async function prepareHD() {
    try {
        const mod = await import('./hd_worker_imports');
        await mod.waitForBuildingGen();
        BuildingBucket = mod.BuildingBucket;

    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}
