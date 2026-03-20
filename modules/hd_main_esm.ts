import {warnOnce} from '../src/util/util';

export const HD = {};

export async function prepareHD() {
    try {
        Object.assign(HD, await import('./hd_main_imports'));
    } catch (error) {
        warnOnce('Could not load HD module.');
    }
}
