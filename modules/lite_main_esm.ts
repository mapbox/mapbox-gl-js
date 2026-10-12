import {warnOnce} from '../src/util/util';

import type {Lite as LiteType} from './lite_main_imports';

export const Lite: Partial<typeof LiteType> = {};

let pending: Promise<void> | null = null;

export function prepareLite(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./lite_main_imports').then(({Lite: liteModule}) => {
        Object.assign(Lite, liteModule);
    }).catch(() => {
        pending = null;
        warnOnce('Could not load Lite module.');
    });
    return pending;
}
