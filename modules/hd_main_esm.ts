import {warnOnce} from '../src/util/util';

import type {HD as HDType} from './hd_main_imports';

export const HD: Record<never, never> | typeof HDType = {};

export async function prepareHD() {
    try {
        const {HD: hdModule} = await import('./hd_main_imports');
        Object.assign(HD, hdModule);
    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}
