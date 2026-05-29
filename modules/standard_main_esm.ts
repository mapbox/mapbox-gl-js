import {warnOnce} from '../src/util/util';

import type {Standard as StandardType} from './standard_main_imports';

export const Standard: Partial<typeof StandardType> = {};

export async function prepareStandard(): Promise<void> {
    try {
        const {Standard: standardModule} = await import('./standard_main_imports');
        Object.assign(Standard, standardModule);
    } catch (error) {
        warnOnce('Could not load Standard module.');
    }
}
