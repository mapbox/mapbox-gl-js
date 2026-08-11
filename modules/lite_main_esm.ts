import {warnOnce} from '../src/util/util';

import type {Lite as LiteType} from './lite_main_imports';

export const Lite: Partial<typeof LiteType> = {};

export async function prepareLite(): Promise<void> {
    try {
        const {Lite: liteModule} = await import('./lite_main_imports');
        Object.assign(Lite, liteModule);
    } catch (error) {
        warnOnce('Could not load Lite module.');
    }
}
