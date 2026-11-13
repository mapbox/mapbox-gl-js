import {warnOnce} from '../src/util/util';

import type {DebugModule as DebugModuleType} from './debug_imports';

// ESM entry: the DebugModule namespace starts out empty. `prepareDebug()` dynamically
// imports the debug chunk and copies the validators onto `DebugModule` in place, so
// callers that captured a reference to `DebugModule` before loading see the populated
// surface afterwards.
export const DebugModule: Partial<typeof DebugModuleType> = {loaded: false};

let pending: Promise<void> | null = null;

export function prepareDebug(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./debug_imports').then(({DebugModule: loaded}) => {
        Object.assign(DebugModule, loaded);
    }).catch(() => {
        warnOnce('Could not load Debug module; style validation and performance statistics are disabled.');
    });
    return pending;
}
