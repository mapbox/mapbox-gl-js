import {BuildingBucket, waitForBuildingGen} from './hd_worker_imports';

export {BuildingBucket};

export async function prepareHD() { return waitForBuildingGen(); }
