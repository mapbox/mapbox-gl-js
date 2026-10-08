// UMD/CDN entry: the Debug namespace is available synchronously at import time,
// and `prepareDebug()` is a no-op that resolves immediately. The Rollup
// `esm-substitution-resolver` plugin swaps this file for `debug_esm.ts` in ESM
// builds, where the debug chunk is dynamically imported instead.
export {DebugModule} from './debug_imports';

export function prepareDebug(): Promise<void> { return Promise.resolve(); }
