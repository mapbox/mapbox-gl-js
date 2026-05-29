import * as module from './hd_main_imports';

export const HD: Partial<typeof module.HD> = module.HD;

export async function prepareHD() { return Promise.resolve(); }
